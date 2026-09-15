// Child-only runtime. IPC is the control channel; REPL output is never echoed.
const { AsyncLocalStorage } = require("node:async_hooks");
const { spawn } = require("node:child_process");
const { stripTypeScriptTypes } = require("node:module");
const { PassThrough } = require("node:stream");
const { inspect } = require("node:util");
const repl = require("node:repl");

const OUTPUT_LIMIT = 50 * 1024;
const SHELL_LIMIT = 1024 * 1024;
const TRUNCATED = "\n[output truncated]\n";
const scope = new AsyncLocalStorage();
let server;
let active;

function send(message) {
	if (process.connected) process.send(message, () => {});
}

function bounded(text, limit = OUTPUT_LIMIT) {
	const bytes = Buffer.from(text);
	return bytes.length <= limit ? text : bytes.subarray(0, limit).toString() + TRUNCATED;
}

function render(value) {
	if (typeof value === "string") return value;
	if (value && typeof value.render === "function") return String(value.render());
	return inspect(value, { depth: 5, maxArrayLength: 100, maxStringLength: 10_000, getters: false, colors: false });
}

function show(...values) {
	const cell = scope.getStore();
	if (!cell || cell.finished || cell.truncated) return;
	const bytes = Buffer.from(values.map(render).join(" ") + "\n");
	const remaining = OUTPUT_LIMIT - cell.bytes;
	let text = bytes.subarray(0, remaining).toString();
	cell.bytes += Math.min(bytes.length, remaining);
	if (bytes.length > remaining) { text += TRUNCATED; cell.truncated = true; }
	send({ type: "output", id: cell.id, text });
}

function errorText(error) {
	return bounded(error instanceof Error ? error.stack || error.message : String(error));
}

/** Shell captures are independent of displayed output and never receive anchors. */
function sh(command, ...values) {
	if (Array.isArray(command) && Object.hasOwn(command, "raw")) {
		command = command.reduce((text, part, i) => text + (i ? String(values[i - 1]) : "") + part, "");
	}
	if (typeof command !== "string") throw new TypeError("sh expects a command string or tagged template");
	const promise = new Promise((resolve, reject) => {
		// Inherit the kernel process group so reset kills shells and their children.
		const child = spawn("bash", ["-c", command], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
		const stdout = capture(child.stdout);
		const stderr = capture(child.stderr);
		child.once("error", reject);
		// 'close', not 'exit': drain both pipes before exposing a result.
		child.once("close", (code, signal) => resolve({
			stdout: stdout(), stderr: stderr(), exitCode: code ?? (signal ? 128 + (require("node:os").constants.signals[signal] || 0) : 1),
		}));
	});
	// A retained, not-yet-awaited shell promise must not crash the kernel.
	promise.catch(() => {});
	return promise;
}

function capture(stream) {
	const chunks = [];
	let size = 0;
	let truncated = false;
	stream.on("data", (chunk) => {
		const remaining = SHELL_LIMIT - size;
		if (chunk.length > remaining) truncated = true;
		if (remaining > 0) { chunks.push(chunk.subarray(0, remaining)); size += Math.min(chunk.length, remaining); }
	});
	return () => Buffer.concat(chunks).toString() + (truncated ? TRUNCATED : "");
}

function notify(promise, label) {
	if (label !== undefined && typeof label !== "string") throw new TypeError("notify label must be a string");
	Promise.resolve(promise).then(
		(value) => {
			let output;
			try { output = bounded(render(value)); } catch (error) { output = errorText(error); }
			send({ type: "notification", event: { label, output } });
		},
		(error) => send({ type: "notification", event: { label, output: "", error: errorText(error) } }),
	);
	return promise;
}

async function initialize(message) {
	if (typeof stripTypeScriptTypes !== "function") throw new Error("exec requires Node >= 22.13 for TypeScript transpilation");
	const { createJiti } = require(message.loader);
	const jiti = createJiti(__filename, { interopDefault: true });
	const [{ createSourceAPI }, { Ledger }] = await Promise.all([
		jiti.import("./source.ts"), jiti.import("../outline-read/ledger.ts"),
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
	server = repl.start({ input: new PassThrough(), output: new PassThrough(), terminal: false, useGlobal: false, ignoreUndefined: true });
	Object.assign(server.context, api, { show, sh, notify });
	server.context.console = { ...console, log: show, info: show, warn: show, error: show, debug: show, dir: show };
	// Node's default REPL evaluator reports thrown errors through its domain,
	// rather than the eval callback. Keep partial explicit output in either case.
	server._domain.on("error", (error) => {
		const cell = scope.getStore() || active;
		cell?.finish(error);
	});
	send({ type: "ready" });
}

function execute(message) {
	const cell = {
		id: message.id, bytes: 0, truncated: false, finished: false,
		finish(error) {
			if (cell.finished) return;
			cell.finished = true;
			if (active === cell) active = undefined;
			send({ type: "done", id: cell.id, ...(error ? { error: errorText(error) } : {}) });
		},
	};
	active = cell;
	scope.run(cell, () => {
		try {
			const code = stripTypeScriptTypes(message.code, { mode: "transform", sourceUrl: "exec.ts" });
			server.eval(code + "\n", server.context, "exec.ts", (error) => cell.finish(error));
		} catch (error) { cell.finish(error); }
	});
}

process.on("message", (message) => {
	if (message.type === "init") initialize(message).catch((error) => send({ type: "fatal", error: errorText(error) }));
	else if (message.type === "execute") execute(message);
});

// Parent crashes should not leave ordinary shell descendants behind.
process.on("disconnect", () => {
	if (process.platform !== "win32") {
		try { process.kill(-process.pid, "SIGKILL"); } catch { process.exit(0); }
	} else process.exit(0);
});
