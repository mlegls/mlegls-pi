// Child-only runtime. IPC is the control channel; REPL output is never echoed.
const { AsyncLocalStorage } = require("node:async_hooks");
const { spawn } = require("node:child_process");
const { mkdir, writeFile } = require("node:fs/promises");
const { dirname, resolve } = require("node:path");
const vm = require("node:vm");
const { inspect } = require("node:util");
const { createTrace } = require("./trace.cjs");
const { register, format } = require("./passive.cjs");
const { createSkillLoader } = require("./skill-loader.cjs");
const DEFAULT_MODULES = ["fs", "sh", "exa", "term", "ui"];
let modules = new Set(DEFAULT_MODULES);

function traced(name, fn) {
	return function (...args) {
		const trace = scope.getStore()?.trace;
		return trace ? Reflect.apply(trace.wrap(name, fn), this, args) : Reflect.apply(fn, this, args);
	};
}

// Text budgets are per show call (per output handle), not per cell.
const OUTPUT_LIMIT = 8 * 1024;
const LARGE_OUTPUT_LIMIT = 32 * 1024;
const SHELL_LIMIT = 1024 * 1024;
const TRUNCATED = "\n[output truncated]\n";
const scope = new AsyncLocalStorage();
let exec;
let active;
let ingress;
let ingressQuery = "";
let ingressEnabled = true;
const transpiler = new Bun.Transpiler({ loader: "ts" });
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
		this.structuredContent = result.structuredContent;
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
	ui: Object.freeze(Object.assign(Object.fromEntries(["list_apps", "list_windows", "get_window_state", "verify_state", "click", "type_text", "press_key", "set_value", "scroll", "drag"].map(name => [name, args => uiCall(name, args)])), { help: uiHelp, reset: () => rpc("ui", "reset", {}) })),

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
	if (value?.constructor?.name === "ShellOutput" && Buffer.isBuffer(value.stdout)) {
		const stdout = value.stdout.toString(), stderr = value.stderr.toString(), { exitCode } = value;
		return stdout + (stderr ? (stdout && !stdout.endsWith("\n") ? "\n" : "") + "stderr:\n" + stderr : "") + (exitCode ? "\n[exit " + exitCode + "]" : "");
	}
	const passive = format(value, Infinity);
	if (passive) return passive.text;
	return inspect(value, { depth: 5, maxArrayLength: 100, maxStringLength: 10_000, getters: false, colors: false });
}

function isPromise(value) {
	return value != null && typeof value.then === "function";
}

function display(value, raw = false, query = scope.getStore()?.query ?? ingressQuery, focus, budget = OUTPUT_LIMIT) {
	if (isPromise(value)) return Promise.resolve(value).then(value => display(value, raw, query, focus, budget));
	const rendered = value && typeof value.content === "function" ? value.content() : render(value);
	if (!ingressEnabled || raw || (!query && !focus) || protectedDisplay.has(value) || uiHelpResults.has(value)) return rendered;
	return Promise.resolve(rendered).then(async result => {
		if (!ingressEnabled || protectedDisplay.has(result)) return result;
		if (!Array.isArray(result)) return ingress.filter(String(result), query, budget, focus);
		const filtered = await Promise.all(result.map(async block => block.type === "text"
			? { ...block, text: await ingress.filter(block.text, query, budget, focus) } : block));
		const error = contentErrors.get(result);
		if (error) contentErrors.set(filtered, error);
		return filtered;
	});
}

function emitValues(cell, values, call = 0) {
	let texts = [];
	const flush = () => { if (texts.length) { emit(cell, texts.join(" ") + "\n", call); texts = []; } };
	for (const value of values) {
		if (!Array.isArray(value)) { texts.push(value); continue; }
		flush();
		cell.renderError ??= contentErrors.get(value);
		for (const block of value) {
			if (block.type === "text") emit(cell, block.text + "\n", call);
			else if (block.type === "image" && !cell.finished) {
				const bytes = Buffer.byteLength(block.data);
				if (cell.images >= 8 || cell.imageBytes + bytes > 20 * 1024 * 1024) {
					if (!cell.imageWarning) {
						cell.imageWarning = true;
						cell.deliver({ type: "output", id: cell.id, call, text: "\n[image limit reached: max 8 images / 20 MiB base64; retained values can be displayed later]\n", warning: true });
					}
				} else {
					cell.images++; cell.imageBytes += bytes;
					cell.deliver({ type: "image", id: cell.id, call, data: block.data, mimeType: block.mimeType });
				}
			}
		}
	}
	flush();
}

// Output handles: "c<cell>" settles when the cell body and all its shows finish;
// "c<cell>.<call>" settles when that show call has emitted. Handles are addresses,
// so waiting on one is the same whether it was made in this cell or an earlier one.
const handles = new Map();

function splitOptions(values) {
	const last = values.at(-1);
	return values.length > 1 && last && typeof last === "object" && !Array.isArray(last)
		&& Object.keys(last).length === 1 && typeof last.focus === "string" ? values.pop().focus : undefined;
}

function show(...values) {
	const focus = splitOptions(values);
	return showValues(false, values, focus);
}

// One show call: announced to the host, emitted when its values resolve (independently
// of earlier calls), then marked done. sync calls hold the tool result past the yield.
function track(cell, work, sync, emitResult, limit = OUTPUT_LIMIT) {
	const call = ++cell.calls;
	const handle = "c" + cell.id + "." + call;
	cell.budgets.set(call, { limit, bytes: 0, omitted: 0 });
	send({ type: "show", id: cell.id, call, sync });
	let failure;
	const pending = Promise.resolve(work).then(value => { emitResult(value, call); outputWarning(cell, call); });
	const done = pending.then(() => {}, error => { failure = error; cell.renderError ??= error; });
	cell.pending.add(done);
	void done.then(() => {
		cell.pending.delete(done);
		send({ type: "show-done", id: cell.id, call, ...(failure ? { error: errorText(failure) } : {}) });
	});
	handles.set(handle, done);
	return pending;
}

function showValues(raw, values, focus, sync = false, limit = OUTPUT_LIMIT) {
	const cell = scope.getStore();
	if (!cell || cell.finished) return Promise.resolve();
	const rendered = values.map(value => display(value, raw, undefined, focus, limit));
	const work = rendered.some(isPromise) ? Promise.all(rendered) : rendered;
	return track(cell, work, sync, (values, call) => emitValues(cell, values.length ? values : [""], call), limit);
}

show.raw = (...values) => showValues(true, values);
show.pull = (id) => show.raw(HANDLE.test(id) ? handleOutput(id) : ingress.pull(id));

// Emitted text by handle, so output delivered in collapsed form stays recoverable until reset.
const HANDLE = /^c\d+(?:\.(?:\d+|io))?$/;
const outputs = new Map();
function handleOutput(id) {
	const keys = id.includes(".") ? [id] : [...outputs.keys()].filter(key => key === id || (key.startsWith(id + ".") && !key.endsWith(".io")));
	if (!keys.some(key => outputs.has(key))) throw new Error("No output recorded for handle " + id + "; handle output expires on kernel reset");
	return keys.map(key => outputs.get(key) ?? "").join("");
}
show.sync = (...values) => {
	const focus = splitOptions(values);
	return showValues(false, values, focus, true);
};

/** Block this cell's tool result until the named output handles settle. */
function wait(...ids) {
	const cell = scope.getStore();
	if (!cell || cell.finished) return Promise.resolve();
	const targets = ids.map(id => {
		const target = handles.get(String(id));
		if (!target) throw new Error("Unknown output handle " + JSON.stringify(id) + "; handles look like c7 or c7.2");
		return target;
	});
	return track(cell, Promise.all(targets), true, (_values, call) => emit(cell, "settled: " + ids.join(", ") + "\n", call));
}

show.large = (...values) => {
	const focus = splitOptions(values);
	return showValues(false, values, focus, false, LARGE_OUTPUT_LIMIT);
};

function budgetOf(cell, call) {
	let budget = cell.budgets.get(call);
	if (!budget) cell.budgets.set(call, budget = { limit: OUTPUT_LIMIT, bytes: 0, omitted: 0 });
	return budget;
}

function outputWarning(cell, call) {
	const budget = cell.budgets.get(call);
	if (!budget?.omitted || cell.finished) return;
	const large = budget.limit >= LARGE_OUTPUT_LIMIT;
	cell.deliver({ type: "output", id: cell.id, call, warning: true, text: `\n[output truncated] ${budget.omitted} UTF-8 bytes omitted from this show (${budget.limit / 1024} KiB); retained values unchanged. Select a smaller slice${large ? "" : " or use show.large(value) (32 KiB)"}.\n` });
	budget.omitted = 0;
}

// Process stdout/stderr written during a cell (library logging, the global console, stray
// process.stdout.write) is that cell's side stream: kept under handle cN.io and announced
// in one collapsed line when the cell finishes. Writes outside any cell stay kernel
// diagnostics, as do subprocesses writing to inherited descriptors.
const STREAM_LIMIT = 256 * 1024;
function captureStreams() {
	for (const name of ["stdout", "stderr"]) {
		const stream = process[name], write = stream.write.bind(stream);
		stream.write = (chunk, encoding, callback) => {
			const cell = scope.getStore();
			if (!cell) return write(chunk, encoding, callback);
			const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
			const key = "c" + cell.id + ".io", prior = outputs.get(key) ?? "";
			if (prior.length < STREAM_LIMIT) outputs.set(key, prior + text);
			const io = cell.io ??= { lines: 0, stderr: 0, first: "" };
			const lines = (text.match(/\n/g) || []).length || 1;
			io.lines += lines;
			if (name === "stderr") io.stderr += lines;
			if (!io.first) io.first = text.trim().split("\n")[0];
			(typeof encoding === "function" ? encoding : callback)?.();
			return true;
		};
	}
	// Bun's native console bypasses process.stdout.write; route the global one through it.
	globalThis.console = new (require("node:console").Console)({ stdout: process.stdout, stderr: process.stderr });
}

function streamNotice(cell) {
	const { lines, stderr, first } = cell.io;
	const cue = first.length > 120 ? first.slice(0, 120) + "…" : first;
	return "[io: " + lines + " line" + (lines === 1 ? "" : "s") + (stderr ? " (" + stderr + " stderr)" : "") + " written to stdout/stderr, not shown: " + JSON.stringify(cue) + '; show.pull("c' + cell.id + '.io")]\n';
}

function emit(cell, value, call = 0) {
	if (cell.finished) return;
	const bytes = Buffer.from(value);
	const budget = budgetOf(cell, call);
	const remaining = Math.max(0, budget.limit - budget.bytes);
	let end = Math.min(bytes.length, remaining);
	while (end > 0 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
	const text = bytes.subarray(0, end).toString();
	budget.bytes += end;
	budget.omitted += bytes.length - end;
	const key = "c" + cell.id + (call ? "." + call : "");
	if (text) outputs.set(key, (outputs.get(key) ?? "") + text);
	if (text) cell.deliver({ type: "output", id: cell.id, call, text });
}

function errorText(error) {
	// V8: "Identifier 'x' has already been declared"; JSC: "Cannot declare a const variable twice: 'x'."
	const collision = /(?:Identifier|declare)[^'"]*['"]([^'"]+)['"]/.exec(error?.message || "");
	if (error?.name === "SyntaxError" && collision && (collision[1] === "__exec" || Object.hasOwn(exec ?? {}, collision[1]))) {
		return `Reserved exec binding "${collision[1]}" cannot be declared at cell top level. Rename it or use a nested scope; retain values on state.`;
	}
	const shellStderr = error instanceof Bun.$.ShellError ? error.stderr.toString() : "";
	const text = bounded((error instanceof Error ? error.stack || error.message : String(error)) + (shellStderr ? "\nstderr:\n" + shellStderr : ""));
	const missing = /^(.+) is not defined$/.exec(error?.message || "");
	if (error?.name === "ReferenceError" && missing) {
		const name = missing[1];
		const retained = exec?.state;
		const target = "state[" + JSON.stringify(name) + "]";
		const access = /^[A-Za-z_$][\w$]*$/.test(name) ? "state." + name : target;
		return text + "\nExec locals do not persist between calls. " + (retained && Object.hasOwn(retained, name)
			? access + " exists; use it to access the retained value."
			: "Retain cross-call values explicitly as " + access + "; otherwise declare the name in this call.");
	}
	return text;
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

async function initialize(message) {
	ingressEnabled = message.ingressEnabled ?? true;
	const reader = message.profile === "reader";
	modules = new Set((message.modules ?? DEFAULT_MODULES).filter(name => name !== "board" && name !== "wm" && (!reader || name === "fs" || name === "exa")));
	if (typeof Bun === "undefined") throw new Error("the exec kernel runs on Bun");
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
	const capabilities = { show, wait };
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
		// Bun Shell quotes interpolated values as arguments and rejects on nonzero exit (use .nothrow()).
		// Quiet by default: kernel stdout is diagnostics, not cell output. Untraced: tracing would
		// replace the ShellPromise and lose .nothrow()/.text()/.lines().
		capabilities.$ = Object.assign((strings, ...values) => Bun.$(strings, ...values).quiet(), { escape: Bun.$.escape, braces: Bun.$.braces, ShellError: Bun.$.ShellError });
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
	captureStreams();
	capabilities.console = Object.freeze({ ...console, log: show, info: show, warn: show, error: show, debug: show, dir: show });
	capabilities.state = Object.create(null);
	const { pathToFileURL } = require("node:url");
	const { resolveCellModules } = await import("./modules.ts");
	const project = Object.create(null);
	for (const mod of reader ? [] : await resolveCellModules(message.cwd)) {
		const loaded = Object.freeze({ ...(await import(pathToFileURL(mod.path).href)) });
		if (typeof loaded.attach === "function") loaded.attach(capabilities);
		if (mod.scope === "project") project[mod.name] = loaded;
		else capabilities[mod.name] = loaded;
	}
	ingress = (reader ? await import("../../lib/ingress.ts") : capabilities.ingress).create({ record: event => send({ type: "ingress", event }) });
	if (!reader) capabilities.project = Object.freeze(project);
	exec = Object.freeze(capabilities);
	Object.defineProperty(globalThis, Symbol.for("pi.exec"), { value: exec, writable: false, configurable: false });
	// Errors thrown outside a cell's promise chain (timers, emitters) belong to the cell that scheduled them.
	const orphan = (error) => {
		const cell = scope.getStore() || active;
		if (cell && !cell.finished) cell.finish(error);
		else process.stderr.write(errorText(error) + "\n");
	};
	process.on("uncaughtException", orphan);
	process.on("unhandledRejection", orphan);
	send({ type: "ready" });
}

function execute(message) {
	ingressQuery = message.query ?? "";
	const cell = {
		query: ingressQuery,
		id: message.id, calls: 0, images: 0, imageBytes: 0, deliver: send, budgets: new Map(), truncated: false, finished: false, finishing: false, pending: new Set(),
		async finish(error) {
			if (cell.finished || cell.finishing) return;
			cell.finishing = true;
			// Flush promised views even when show() was not explicitly awaited.
			while (cell.pending.size) await Promise.allSettled([...cell.pending]);
			outputWarning(cell, 0);
			if (cell.io) cell.deliver({ type: "output", id: cell.id, call: 0, warning: true, text: streamNotice(cell) });
			cell.finished = true;
			cell.trace.finish();
			if (active === cell) active = undefined;
			error ??= cell.renderError;
			send({ type: "done", id: cell.id, ...(error ? { error: errorText(error) } : {}) });
			settled();
		},
	};
	let settled;
	handles.set("c" + cell.id, new Promise(resolve => { settled = resolve; }));
	cell.trace = createTrace(cell, send);
	active = cell;
	scope.run(cell, () => {
		try {
			const code = transpiler.transformSync(message.code);
			// Same-scope const declarations reserve API names before any cell code runs.
			// The async function also keeps var/function declarations local to this call.
			const body = vm.runInThisContext('(async function () { "use strict"; const __exec = globalThis[Symbol.for("pi.exec")]; const { ' + Object.keys(exec).join(", ") + ' } = __exec;\n' + code + '\n})', { filename: "exec.ts", importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER });
			body().then(() => cell.finish(), (error) => cell.finish(error));
		} catch (error) { cell.finish(error); }
	});
}

process.on("message", (message) => {
	if (message.type === "init") initialize(message).catch((error) => send({ type: "fatal", error: errorText(error) }));
	else if (message.type === "execute") execute(message);
	else if (message.type === "ingress-policy") ingressEnabled = message.enabled;
	else if (message.type === "response") resolveMessage(message);
	else if (message.type === "ping") send({ type: "pong", nonce: message.nonce });
});

// Parent crashes should not leave ordinary shell descendants behind.
process.on("disconnect", () => {
	rejectPending("The kernel host disconnected");
	if (process.platform !== "win32") {
		try { process.kill(-process.pid, "SIGKILL"); } catch { process.exit(0); }
	} else process.exit(0);
});
