// Child-only runtime. IPC is the control channel; REPL output is never echoed.
const { AsyncLocalStorage } = require("node:async_hooks");
const { spawn } = require("node:child_process");
const { mkdir, writeFile } = require("node:fs/promises");
const { dirname, resolve } = require("node:path");
const { stripTypeScriptTypes } = require("node:module");
const { PassThrough, Writable } = require("node:stream");
const { inspect } = require("node:util");
const repl = require("node:repl");
const { createTrace } = require("./trace.cjs");
const { register, format } = require("./passive.cjs");
const { createSkillLoader } = require("./skill-loader.cjs");
const DEFAULT_MODULES = ["fs", "sh", "exa", "board", "wm", "term", "ui"];
let modules = new Set(DEFAULT_MODULES);

function traced(name, fn) {
	return function (...args) {
		const trace = scope.getStore()?.trace;
		return trace ? Reflect.apply(trace.wrap(name, fn), this, args) : Reflect.apply(fn, this, args);
	};
}

const OUTPUT_LIMIT = 16 * 1024;
const LARGE_OUTPUT_LIMIT = 50 * 1024;
const SHELL_LIMIT = 1024 * 1024;
const TRUNCATED = "\n[output truncated]\n";
const scope = new AsyncLocalStorage();
let server;
let active;
let ingress;
let ingressQuery = "";
const protectedDisplay = new WeakSet();
const protect = value => { protectedDisplay.add(value); return value; };

// Child→host service calls. Responses arrive on the same IPC channel as control messages.
let requestSequence = 0;
const pending = new Map();

function send(message) {
	if (process.connected) process.send(message, () => {});
}

function rpc(namespace, method, args) {
	if (!modules.has(namespace)) return Promise.reject(new Error(`Exec module ${namespace} is disabled`));
	return new Promise((resolve, reject) => {
		const id = ++requestSequence;
		pending.set(id, { resolve, reject });
		if (!process.connected) {
			pending.delete(id);
			reject(new Error(`Host service ${namespace}.${method} is unavailable: the kernel host is disconnected`));
			return;
		}
		try {
			process.send({ type: "request", id, namespace, method, args }, (error) => {
				if (!error) return;
				pending.delete(id);
				reject(new Error(String(error)));
			});
		} catch (error) {
			pending.delete(id);
			reject(error instanceof Error ? error : new Error(String(error)));
		}
	});
}

async function termCall(method, args) {
	const result = await rpc("term", method, args);
	const mark = (value) => {
		if (!value || typeof value !== "object") return;
		register(value, "terminal");
		if (Array.isArray(value)) value.forEach(mark);
		else if (value.snapshots) value.snapshots.forEach(mark);
	};
	mark(result);
	return result;
}
const uiHelpResults = new WeakSet();
async function uiHelp(method) {
	const result = await rpc("ui", "help", method ? { method } : {});
	uiHelpResults.add(result);
	for (const item of result) uiHelpResults.add(item);
	return result;
}
const contentErrors = new WeakMap();
class UIResult {
	#blocks;
	constructor(result) {
		this.details = result.details;
		this.capture = result.capture;
		this.isError = Boolean(result.isError);
		this.#blocks = result.content;
	}
	content() {
		const blocks = this.#blocks.slice();
		if (this.isError) contentErrors.set(blocks, new Error("UI operation failed"));
		return blocks;
	}
}
async function uiCall(method, args) {
	return new UIResult(await rpc("ui", method, args ?? {}));
}
/**
 * The model-facing service surface. Most host adapters receive flat objects;
 * terminals retain positional argument arrays. Both cross IPC as JSON.
 */
const services = {
	exa: {
		search: (query, options) => rpc("exa", "search", { query, ...(options ?? {}) }),
		contents: (urls, options) => rpc("exa", "contents", { urls, ...(options ?? {}) }),
	},
	board: {
		help: (method) => rpc("board", "help", { method }),
		send: (input) => rpc("board", "send", input),
		read: (options) => rpc("board", "read", options ?? {}),
		list: (options) => rpc("board", "list", options ?? {}),
		subscribe: (options) => rpc("board", "subscribe", options),
		ack: (ids) => rpc("board", "ack", { ids }),
	},
	wm: {
		help: (method) => rpc("wm", "help", { method }),
		spawn: (options) => rpc("wm", "spawn", options),
		wait: (options) => rpc("wm", "wait", options ?? {}),
		send: (handle, text, options) => rpc("wm", "send", { handle, text, ...(options ?? {}) }),
		capture: (handle, options) => rpc("wm", "capture", { handle, ...(options ?? {}) }),
		merge: (handles, options) => rpc("wm", "merge", { handles, ...(options ?? {}) }),
		close: (handles, options) => rpc("wm", "close", { handles, ...(options ?? {}) }),
		status: () => rpc("wm", "status", {}),
		agents: () => rpc("wm", "agents", {}),
	},
	term: {
		spawn: (options) => termCall("spawn", [options]),
		wait: (options) => termCall("wait", [options]),
		view: (id, options) => termCall("view", [id, options]),
		send: (id, text, options) => termCall("send", [id, text, options]),
		sendRaw: (id, keys) => termCall("sendRaw", [id, keys]),
		end: (id) => termCall("end", [id]),
		list: () => termCall("list", []),
	},
	ui: {
		findRoots: (args) => uiCall("findRoots", args),
		observe: (args) => uiCall("observe", args),
		search: (args) => uiCall("search", args),
		expand: (args) => uiCall("expand", args),
		inspect: (args) => uiCall("inspect", args),
		act: (args) => uiCall("act", args),
		readText: (args) => uiCall("readText", args),
		waitFor: (args) => uiCall("waitFor", args),
		help: uiHelp,
	},
	// Escape hatch for namespaces not yet given a typed surface.
	host: { call: (namespace, method, args) => rpc(namespace, method, args) },
};

function resolveMessage(message) {
	const entry = pending.get(message.id);
	if (!entry) return;
	pending.delete(message.id);
	if (message.ok) {
		entry.resolve(message.value);
		return;
	}
	const error = new Error(message.error || "host service call failed");
	error.name = "HostServiceError";
	entry.reject(error);
}

function rejectPending(reason) {
	const error = new Error(reason);
	for (const entry of pending.values()) entry.reject(error);
	pending.clear();
}

function bounded(text, limit = OUTPUT_LIMIT) {
	const bytes = Buffer.from(text);
	return bytes.length <= limit ? text : bytes.subarray(0, limit).toString() + TRUNCATED;
}

function render(value) {
	if (typeof value === "string") return value;
	if (uiHelpResults.has(value)) return JSON.stringify(value, null, 2);
	if (value && typeof value.render === "function") {
		const rendered = value.render();
		return isPromise(rendered) ? Promise.resolve(rendered).then(String) : String(rendered);
	}
	const passive = format(value, Infinity);
	if (passive) return passive.text;
	return inspect(value, { depth: 5, maxArrayLength: 100, maxStringLength: 10_000, getters: false, colors: false });
}

function isPromise(value) {
	return value != null && typeof value.then === "function";
}

function display(value, raw = false, query = scope.getStore()?.query ?? ingressQuery) {
	if (isPromise(value)) return Promise.resolve(value).then(value => display(value, raw, query));
	const rendered = value && typeof value.content === "function" ? value.content() : render(value);
	if (raw || !query || protectedDisplay.has(value) || uiHelpResults.has(value)) return rendered;
	return Promise.resolve(rendered).then(async result => {
		if (protectedDisplay.has(result)) return result;
		if (!Array.isArray(result)) return ingress.filter(String(result), query);
		const filtered = await Promise.all(result.map(async block => block.type === "text"
			? { ...block, text: await ingress.filter(block.text, query) } : block));
		const error = contentErrors.get(result);
		if (error) contentErrors.set(filtered, error);
		return filtered;
	});
}

function emitValues(cell, values) {
	let texts = [];
	const flush = () => { if (texts.length) { emit(cell, texts.join(" ") + "\n"); texts = []; } };
	for (const value of values) {
		if (!Array.isArray(value)) { texts.push(value); continue; }
		flush();
		cell.renderError ??= contentErrors.get(value);
		for (const block of value) {
			if (block.type === "text") emit(cell, block.text + "\n");
			else if (block.type === "image" && !cell.finished) {
				const bytes = Buffer.byteLength(block.data);
				if (cell.images >= 8 || cell.imageBytes + bytes > 20 * 1024 * 1024) {
					if (!cell.imageWarning) {
						cell.imageWarning = true;
						cell.deliver({ type: "output", id: cell.id, text: "\n[image limit reached: max 8 images / 20 MiB base64; retained values can be displayed later]\n", warning: true });
					}
				} else {
					cell.images++; cell.imageBytes += bytes;
					cell.deliver({ type: "image", id: cell.id, data: block.data, mimeType: block.mimeType });
				}
			}
		}
	}
	flush();
}

function show(...values) { return showValues(false, values); }

function showValues(raw, values) {
	const cell = scope.getStore();
	if (!cell || cell.finished) return Promise.resolve();
	const rendered = values.map(value => display(value, raw));
	if (!cell.tail && !rendered.some(isPromise)) {
		emitValues(cell, rendered.length ? rendered : [""]);
		return Promise.resolve();
	}
	const resolved = Promise.all(rendered);
	const pending = Promise.all([cell.tail, resolved]).then(([, values]) => emitValues(cell, values.length ? values : [""]));
	cell.tail = pending.catch(() => {});
	cell.pending.add(pending);
	pending.then(
		() => cell.pending.delete(pending),
		(error) => { cell.pending.delete(pending); cell.renderError ??= error; },
	);
	return pending;
}

show.raw = (...values) => showValues(true, values);
show.pull = (id) => show.raw(ingress.pull(id));

show.large = (...values) => {
	const cell = scope.getStore();
	if (cell) cell.outputLimit = LARGE_OUTPUT_LIMIT;
	return show(...values);
};

function outputWarning(cell) {
	if (!cell.omittedBytes) return;
	cell.deliver({ type: "output", id: cell.id, warning: true, text: `\n[output truncated] ${cell.omittedBytes} UTF-8 bytes omitted; retained values unchanged. Select a smaller slice or use show.large(value) in a new cell (50 KiB ceiling).\n` });
}

function emit(cell, value) {
	if (cell.finished) return;
	const bytes = Buffer.from(value);
	const remaining = Math.max(0, (cell.outputLimit ?? OUTPUT_LIMIT) - cell.bytes);
	let end = Math.min(bytes.length, remaining);
	while (end > 0 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
	const text = bytes.subarray(0, end).toString();
	cell.bytes += end;
	cell.omittedBytes = (cell.omittedBytes ?? 0) + bytes.length - end;
	if (text) cell.deliver({ type: "output", id: cell.id, text });
}

function errorText(error) {
	const collision = /Identifier ['"]([^'"]+)['"] has already been declared/.exec(error?.message || "");
	if (error?.name === "SyntaxError" && collision && (collision[1] === "__exec" || Object.hasOwn(server.context.__exec, collision[1]))) {
		return `Reserved exec binding "${collision[1]}" cannot be declared at cell top level. Rename it or use a nested scope; retain values on state.`;
	}
	return bounded(error instanceof Error ? error.stack || error.message : String(error));
}

/** Shell captures are independent of displayed output and never receive anchors. */
function sh(command, ...values) {
	return runShell(template(command, values));
}

function template(input, values, raw = false) {
	if (raw && !(Array.isArray(input) && Object.hasOwn(input, "raw"))) throw new TypeError("raw expects a tagged template");
	if (Array.isArray(input) && Object.hasOwn(input, "raw")) return (raw ? input.raw : input).reduce((text, part, i) => text + (i ? String(values[i - 1]) : "") + part, "");
	return input;
}

function runShell(command, options = {}) {
	if (typeof command !== "string") throw new TypeError("sh expects a command string or tagged template");
	const promise = new Promise((resolve, reject) => {
		// Inherit the kernel process group so reset kills shells and their children.
		const child = spawn("bash", ["-c", command], { cwd: process.cwd(), ...options, stdio: ["ignore", "pipe", "pipe"] });
		const partial = (stream) => (text) => send({ type: "shell-output", shell: child.pid, stream, text });
		const stdout = capture(child.stdout, partial("stdout"));
		const stderr = capture(child.stderr, partial("stderr"));
		child.once("error", reject);
		// 'close', not 'exit': drain both pipes before exposing a result.
		child.once("close", (code, signal) => {
			send({ type: "shell-done", shell: child.pid });
			const result = {
				stdout: stdout.text(), stderr: stderr.text(),
				stdoutTruncated: stdout.truncated(), stderrTruncated: stderr.truncated(),
				exitCode: code ?? (signal ? 128 + (require("node:os").constants.signals[signal] || 0) : 1),
			};
			register(result, "shell");
			resolve(result);
		});
	});
	// A retained, not-yet-awaited shell promise must not crash the kernel.
	promise.catch(() => {});
	return promise;
}

function capture(stream, onPartial) {
	const chunks = [];
	let size = 0;
	let truncated = false;
	stream.on("data", (chunk) => {
		// Mirror only a display-sized prefix to the host, for forced termination.
		if (size < 50 * 1024) onPartial?.(chunk.subarray(0, 50 * 1024 - size).toString());
		const remaining = SHELL_LIMIT - size;
		if (chunk.length > remaining) truncated = true;
		if (remaining > 0) { chunks.push(chunk.subarray(0, remaining)); size += Math.min(chunk.length, remaining); }
	});
	return {
		text: () => Buffer.concat(chunks).toString() + (truncated ? TRUNCATED : ""),
		truncated: () => truncated,
	};
}

async function write(path, content) {
	if (typeof path !== "string" || typeof content !== "string") throw new TypeError("write expects a path string and UTF-8 text string");
	path = resolve(process.cwd(), path);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, "utf8");
	return { path, bytes: Buffer.byteLength(content, "utf8") };
}

// Observe without awaiting the work: an early status check cannot consume a cell deadline.
const polled = new WeakMap();
async function poll(promise) {
	if (!promise || typeof promise.then !== "function") throw new TypeError("poll expects a retained promise");
	if (!polled.has(promise)) {
		polled.set(promise, Object.freeze({ status: "pending" }));
		Promise.resolve(promise).then(
			value => polled.set(promise, Object.freeze({ status: "ready", value })),
			error => polled.set(promise, Object.freeze({ status: "failed", error })),
		);
	}
	// A REPL promise is from another realm; let its adoption/reaction microtasks drain.
	await new Promise(resolve => setImmediate(resolve));
	return polled.get(promise);
}

function notify(promise, label) {
	if (label !== undefined && typeof label !== "string") throw new TypeError("notify label must be a string");
	Promise.resolve(promise).then(
		async (value) => {
			const content = [];
			let output = "", error;
			const cell = { bytes: 0, images: 0, imageBytes: 0, deliver(message) {
				if (message.type === "image") content.push({ type: "image", data: message.data, mimeType: message.mimeType });
				else { output += message.text; const last = content.at(-1); if (last?.type === "text") last.text += message.text; else content.push({ type: "text", text: message.text }); }
			} };
			try {
				const displayed = await display(value, false, ingressQuery);
				if (Array.isArray(displayed)) emitValues(cell, [displayed]);
				else emit(cell, displayed);
				if (cell.renderError) error = errorText(cell.renderError);
			} catch (e) { error = errorText(e); }
			outputWarning(cell);
			send({ type: "notification", event: { label, output, content, ...(error ? { error } : {}) } });
		},
		(error) => send({ type: "notification", event: { label, output: "", content: [], error: errorText(error) } }),
	);
	return promise;
}

async function initialize(message) {
	const reader = message.profile === "reader";
	modules = new Set((message.modules ?? DEFAULT_MODULES).filter(name => !reader || name === "fs" || name === "exa"));
	if (typeof stripTypeScriptTypes !== "function") throw new Error("exec requires Node >= 22.13 for TypeScript transpilation");
	const [{ createSourceAPI }, { Ledger }] = await Promise.all([
		import("./source.ts"), import("../../lib/outline-read/ledger.ts"),
	]);
	const ledger = new Ledger();
	for (const entry of message.ledger) ledger.restore(entry);
	const api = createSourceAPI({
		cwd: message.cwd,
		ledger,
		persist(path) {
			const entry = ledger.entry(path);
			if (entry) send({ type: "persist", entry });
		},
	});
	const sink = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
	server = repl.start({ input: new PassThrough(), output: sink, terminal: false, useGlobal: false, ignoreUndefined: true });
	const capabilities = reader ? { show } : { show, notify, poll };
	if (modules.has("fs")) {
		if (reader) {
			for (const name of ["read", "grep", "find"]) capabilities[name] = traced(name, api[name]);
		} else {
			const loadSkill = createSkillLoader(message.cwd, runShell, register, protect);
			for (const [name, fn] of Object.entries({ ...api, write, loadSkill })) capabilities[name] = traced(name, fn);
			capabilities.edit.raw = traced("edit.raw", (input, ...values) => api.edit(template(input, values, true)));
		}
	}
	if (modules.has("sh")) {
		capabilities.sh = traced("sh", sh);
		capabilities.sh.raw = traced("sh.raw", (input, ...values) => runShell(template(input, values, true)));
	}
	for (const [namespace, methods] of Object.entries(services)) {
		if ((reader && namespace !== "exa") || (namespace !== "host" && !modules.has(namespace))) continue;
		capabilities[namespace] = Object.freeze(Object.fromEntries(Object.entries(methods).map(([method, fn]) => [method, Object.freeze(traced(namespace + "." + method, fn))])));
	}
	// Freeze owned API wrappers, not returned values or Node's console internals.
	for (const value of Object.values(capabilities)) {
		if (typeof value !== "function") continue;
		for (const method of Object.values(value)) if (typeof method === "function") Object.freeze(method);
		Object.freeze(value);
	}
	capabilities.console = Object.freeze({ ...console, log: show, info: show, warn: show, error: show, debug: show, dir: show });
	capabilities.state = Object.create(null);
	const { pathToFileURL } = require("node:url");
	const { resolveCellModules } = await import("./modules.ts");
	const project = Object.create(null);
	for (const mod of reader ? [] : await resolveCellModules(message.cwd)) {
		const loaded = Object.freeze({ ...(await import(pathToFileURL(mod.path).href)) });
		if (mod.scope === "project") project[mod.name] = loaded;
		else capabilities[mod.name] = loaded;
	}
	ingress = (reader ? await import("../../lib/ingress.ts") : capabilities.ingress).create({ record: event => send({ type: "ingress", event }) });
	if (!reader) capabilities.project = Object.freeze(project);
	for (const [name, value] of Object.entries(capabilities)) {
		Object.defineProperty(server.context, name, { value, writable: false, configurable: false });
	}
	Object.defineProperty(server.context, "__exec", { value: Object.freeze(capabilities), writable: false, configurable: false });
	// Node's default REPL evaluator reports thrown errors through its domain,
	// rather than the eval callback. Keep partial explicit output in either case.
	server._domain.on("error", (error) => {
		const cell = scope.getStore() || active;
		cell?.finish(error);
	});
	send({ type: "ready" });
}

function execute(message) {
	ingressQuery = message.query ?? "";
	const cell = {
		query: ingressQuery,
		id: message.id, images: 0, imageBytes: 0, deliver: send, bytes: 0, truncated: false, finished: false, finishing: false, pending: new Set(),
		async finish(error) {
			if (cell.finished || cell.finishing) return;
			cell.finishing = true;
			// Flush promised views even when show() was not explicitly awaited.
			while (cell.pending.size) await Promise.allSettled([...cell.pending]);
			outputWarning(cell);
			cell.finished = true;
			cell.trace.finish();
			if (active === cell) active = undefined;
			error ??= cell.renderError;
			send({ type: "done", id: cell.id, ...(error ? { error: errorText(error) } : {}) });
		},
	};
	cell.trace = createTrace(cell, send);
	active = cell;
	scope.run(cell, () => {
		try {
			const code = stripTypeScriptTypes(message.code, { mode: "transform", sourceUrl: "exec.ts" });
			// Same-scope const declarations reserve API names before any cell code runs.
			// The async function also keeps var/function declarations local to this call.
			const names = Object.keys(server.context.__exec).join(", ");
			server.eval('await (async () => { "use strict"; const __exec = globalThis.__exec; const { ' + names + ' } = __exec;\n' + code + '\n})()\n', server.context, "exec.ts", (error) => cell.finish(error));
		} catch (error) { cell.finish(error); }
	});
}

process.on("message", (message) => {
	if (message.type === "init") initialize(message).catch((error) => send({ type: "fatal", error: errorText(error) }));
	else if (message.type === "execute") execute(message);
	else if (message.type === "response") resolveMessage(message);
});

// Parent crashes should not leave ordinary shell descendants behind.
process.on("disconnect", () => {
	rejectPending("The kernel host disconnected");
	if (process.platform !== "win32") {
		try { process.kill(-process.pid, "SIGKILL"); } catch { process.exit(0); }
	} else process.exit(0);
});
