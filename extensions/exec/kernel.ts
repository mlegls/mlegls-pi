import { fork, spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { LedgerEntry } from "../../lib/outline-read/ledger";
import type { ContentBlock } from "./image";
import type { Event as IngressEvent } from "../../lib/ingress";

export interface KernelTraceEntry {
	id: number;
	name: string;
	args: string;
	state: "pending" | "ok" | "error" | "interrupted";
	startedAt: number;
	durationMs?: number;
	result?: string;
	error?: string;
}

/** UI-only observations; never included in model-visible content/output. */
export interface KernelTrace {
	entries: KernelTraceEntry[];
	omitted: number;
	truncated: boolean;
	/** Pending entries in a finished trace were not awaited by the cell. */
	finished: boolean;
}

export interface KernelResult {
	/** Raw process/interrupted-shell diagnostics are UI-only, not model ingress. */
	diagnostics?: string;
	trace?: KernelTrace;
	content: ContentBlock[];
	output: string;
	error?: string;
	/** Cell number; its output handles are c<cell> (body plus all shows) and c<cell>.<call>. */
	cell?: number;
	/** The result yielded before the cell settled; the rest arrives through onLate. */
	running?: boolean;
}

/** Output that settled after its cell's tool result yielded. */
export interface KernelLate {
	handle: string;
	content: ContentBlock[];
	error?: string;
	/** Passive events ride along with the next delivery but never wake the agent by themselves. */
	passive: boolean;
}

export interface ExecuteOptions {
	/** Cell number; defaults to a per-kernel counter. */
	id?: number;
	signal?: AbortSignal;
	onUpdate?: (trace: KernelTrace) => void;
	query?: string;
	/** Yield with partial output after this long unless a show.sync/wait is pending (default 10s). */
	yieldMs?: number;
	/** Polled while the result is held; true yields immediately (e.g. the user queued a steer). */
	detach?: () => boolean;
}

/** One child→host service call. `signal` aborts when the kernel stops or is disposed. */
export interface KernelRequest {
	namespace: string;
	method: string;
	args: unknown;
	signal: AbortSignal;
}

export interface KernelOptions {
	modules?: readonly string[];
	profile?: "default" | "reader";
	cwd: string;
	sessionFile?: string;
	ledger: LedgerEntry[];
	persist: (entry: LedgerEntry) => void | Promise<void>;
	onLate?: (event: KernelLate) => void;
	onIngress?: (event: IngressEvent) => void;
	/** Host-side implementation of the `exa` / `board` / `wm` namespaces. Must resolve JSON-serializable values. */
	call?: (request: KernelRequest) => Promise<unknown>;
}

const DEFAULT_MODULES = ["fs", "sh", "exa", "term", "ui"];

const LIMIT = 64 * 1024;
const DEFAULT_YIELD_MS = 10_000;

interface CellCall { content: ContentBlock[]; done: boolean; sync: boolean; error?: string }
interface CellRun {
	id: number;
	trace: KernelTrace;
	onUpdate?: (trace: KernelTrace) => void;
	/** Call 0 is cell-level output (limit warnings), not a show. */
	calls: Map<number, CellCall>;
	diagnostics: string;
	bytes: number;
	detached: boolean;
	passive: boolean;
	check: () => void;
	finish: (error?: string) => void;
}

function mergeText(blocks: ContentBlock[]): ContentBlock[] {
	const out: ContentBlock[] = [];
	for (const block of blocks) {
		const last = out.at(-1);
		if (block.type === "text" && last?.type === "text") out[out.length - 1] = { ...last, text: last.text + block.text };
		else if (block.type !== "text" || block.text) out.push(block);
	}
	return out;
}

function textOf(blocks: ContentBlock[]): string {
	return blocks.map(block => block.type === "text" ? block.text : "").join("");
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Persistent explicit state with cell-local scope in a disposable Node process. Not a security sandbox. */
export class Kernel {
	private child?: ChildProcess;
	private ready?: Promise<void>;
	private persistence: Promise<void> = Promise.resolve();
	private persistenceError?: string;
	private entries = new Map<string, LedgerEntry>();
	private calls = new Set<AbortController>();
	private shellOutput = new Map<number, Map<string, string>>();
	private cells = new Map<number, CellRun>();
	private pongs = new Map<number, () => void>();
	private pinging = false;
	private sequence = 0;
	private disposed = false;

	constructor(private readonly options: KernelOptions) {
		for (const entry of options.ledger) this.entries.set(entry.path, entry);
	}

	/**
	 * Run one cell. Cells run concurrently in one kernel; the result settles when the cell
	 * and its shows finish, or yields at yieldMs (unless show.sync/wait is pending) with
	 * whatever has been shown. Later output is reported through onLate by handle.
	 */
	execute(code: string, options: ExecuteOptions = {}): Promise<KernelResult> {
		return this.run(code, options);
	}

	private call(cell: CellRun, call: number): CellCall {
		let record = cell.calls.get(call);
		if (!record) cell.calls.set(call, record = { content: [], done: call === 0, sync: false });
		return record;
	}

	private append(cell: CellRun, call: number, text: string, warning = false): void {
		const bytes = Buffer.byteLength(text);
		if (!warning && cell.bytes + bytes > LIMIT) return;
		if (!warning) cell.bytes += bytes;
		this.call(cell, call).content.push({ type: "text", text });
	}

	private diagnostic(text: string): void {
		const cell = [...this.cells.values()].at(-1);
		if (cell) cell.diagnostics = (cell.diagnostics + text).slice(0, LIMIT);
	}

	private start(): Promise<void> {
		if (this.ready) return this.ready;
		const require = createRequire(import.meta.url);
		const loader = require.resolve("tsx");
		const child = fork(fileURLToPath(new URL("./runtime.cjs", import.meta.url)), [], {
			cwd: this.options.cwd,
			env: { ...process.env, PI_SESSION_FILE: this.options.sessionFile ?? "" },
			execPath: process.versions.bun ? "node" : process.execPath,
			execArgv: ["--disable-warning=ExperimentalWarning", "--import", loader],
			detached: process.platform !== "win32",
			stdio: ["ignore", "pipe", "pipe", "ipc"],
		});
		this.child = child;
		child.stdout?.setEncoding("utf8").on("data", (text) => { if (this.child === child) this.diagnostic(text); });
		child.stderr?.setEncoding("utf8").on("data", (text) => { if (this.child === child) this.diagnostic(text); });
		this.ready = new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error("Kernel startup timed out"));
				void this.stop("Kernel startup timed out");
			}, 15_000);
			child.on("message", (message: any) => {
				if (this.child !== child) return;
				switch (message.type) {
					case "ready": clearTimeout(timer); resolve(); break;
					case "ingress":
						this.persistence = this.persistence.then(() => this.options.onIngress?.(message.event)).catch(error => { this.persistenceError = errorMessage(error); });
						break;
					case "output": { const cell = this.cells.get(message.id); if (cell) this.append(cell, message.call ?? 0, message.text, message.warning); break; }
					case "shell-output": {
						let streams = this.shellOutput.get(message.shell);
						if (!streams) this.shellOutput.set(message.shell, streams = new Map());
						streams.set(message.stream, (streams.get(message.stream) ?? "") + message.text);
						break;
					}
					case "shell-done": this.shellOutput.delete(message.shell); break;
					case "image": this.cells.get(message.id) && this.call(this.cells.get(message.id)!, message.call ?? 0).content.push({ type: "image", data: message.data, mimeType: message.mimeType }); break;
					case "trace": {
						const cell = this.cells.get(message.id);
						if (cell) { cell.trace = message.trace; this.updateTrace(cell); }
						break;
					}
					case "show": {
						const cell = this.cells.get(message.id);
						if (cell) this.call(cell, message.call).sync = Boolean(message.sync);
						break;
					}
					case "show-done": {
						const cell = this.cells.get(message.id);
						if (!cell) break;
						const record = this.call(cell, message.call);
						record.done = true;
						record.error = message.error;
						// No immediate check: the interval tick gives the body's done a moment to follow a finished sync call.
						if (cell.detached) this.late({ handle: `c${cell.id}.${message.call}`, content: mergeText(record.content), error: record.error, passive: cell.passive });
						break;
					}
					case "done": this.cells.get(message.id)?.finish(message.error); break;
					case "pong": this.pongs.get(message.nonce)?.(); break;
					case "request": void this.handleRequest(child, message); break;
					case "persist": {
						const entry = message.entry as LedgerEntry;
						this.entries.set(entry.path, entry);
						this.persistence = this.persistence.then(() => this.options.persist(entry)).catch((error) => {
							this.persistenceError = `Ledger persistence failed: ${String(error)}`;
						});
						break;
					}
					case "fatal":
						clearTimeout(timer); reject(new Error(message.error));
						void this.stop(message.error);
				}
			});
			child.once("error", (error) => {
				clearTimeout(timer); reject(error);
				if (this.child === child) void this.stop(String(error));
			});
			child.once("exit", (code, signal) => {
				clearTimeout(timer);
				const error = `Kernel exited (${signal ?? code}); state was cleared`;
				reject(new Error(error));
				if (this.child === child) void this.stop(error);
			});
			child.send({ type: "init", cwd: this.options.cwd, ledger: [...this.entries.values()], modules: this.options.modules, profile: this.options.profile });
		});
		return this.ready;
	}

	/**
	 * Route one child service call to the host. Each call owns an AbortSignal so a
	 * retained promise (and its host work) unwinds when the kernel stops.
	 */
	private async handleRequest(child: ChildProcess, message: any): Promise<void> {
		const id = message.id;
		if (message.namespace === "board" || message.namespace === "wm" || (this.options.profile === "reader" && message.namespace !== "exa") || !(this.options.modules ?? DEFAULT_MODULES).includes(message.namespace)) {
			this.respond(child, id, { ok: false, error: `Exec module ${String(message.namespace)} is disabled` });
			return;
		}
		const call = this.options.call;
		if (!call) {
			this.respond(child, id, { ok: false, error: `Host service ${message.namespace}.${message.method} is unavailable` });
			return;
		}
		const controller = new AbortController();
		this.calls.add(controller);
		try {
			const value = await call({ namespace: String(message.namespace), method: String(message.method), args: message.args, signal: controller.signal });
			if (this.child === child && !controller.signal.aborted) this.respond(child, id, { ok: true, value: value ?? null });
		} catch (error) {
			if (this.child === child && !controller.signal.aborted) this.respond(child, id, { ok: false, error: errorMessage(error) });
		} finally {
			this.calls.delete(controller);
		}
	}

	/** A service result must be JSON-serializable; a bad one reports to the cell, never kills the kernel. */
	private respond(child: ChildProcess, id: unknown, payload: { ok: boolean; value?: unknown; error?: string }): void {
		try {
			child.send({ type: "response", id, ...payload }, () => {});
		} catch (error) {
			try { child.send({ type: "response", id, ok: false, error: `Host result could not be serialized: ${errorMessage(error)}` }, () => {}); } catch { /* channel gone; exit handler cleans up */ }
		}
	}

	/** After an interrupt, a kernel whose event loop cannot answer within 1s is wedged; only then is it stopped. */
	private async probe(): Promise<void> {
		const child = this.child;
		if (!child || this.pinging) return;
		this.pinging = true;
		const nonce = Math.random();
		const answered = await new Promise<boolean>(resolve => {
			const timer = setTimeout(() => resolve(false), 1000);
			this.pongs.set(nonce, () => { clearTimeout(timer); resolve(true); });
			try { child.send({ type: "ping", nonce }, () => {}); } catch { clearTimeout(timer); resolve(false); }
		});
		this.pongs.delete(nonce);
		this.pinging = false;
		if (!answered && this.child === child) await this.stop("Kernel was unresponsive after interrupt; state was cleared and shell subprocesses stopped");
	}

	private late(event: KernelLate): void {
		try { this.options.onLate?.(event); } catch { /* Delivery must not kill the kernel. */ }
	}

	private async run(code: string, options: ExecuteOptions): Promise<KernelResult> {
		if (this.disposed) return { content: [], output: "", error: "Kernel is disposed" };
		if (options.signal?.aborted) return { content: [], output: "", error: "Execution cancelled" };
		const id = options.id ?? this.sequence + 1;
		this.sequence = Math.max(this.sequence, id);
		const yieldMs = options.yieldMs ?? DEFAULT_YIELD_MS;
		// The yield clock starts when the kernel receives the cell, not during startup.
		let started = Infinity;
		return new Promise<KernelResult>((resolve) => {
			let resolved = false;
			let timer: ReturnType<typeof setInterval> | undefined;
			const ordered = () => [...cell.calls.entries()].filter(([call]) => call !== 0).sort(([a], [b]) => a - b);
			const settle = (result: Omit<KernelResult, "output">) => {
				resolved = true;
				clearInterval(timer);
				options.signal?.removeEventListener("abort", cell.check);
				const trace = structuredClone(cell.trace);
				const content = mergeText(result.content);
				const diagnostics = cell.diagnostics;
				void this.persistence.then(() => {
					const errors = [result.error, this.persistenceError].filter(Boolean);
					this.persistenceError = undefined;
					resolve({ ...result, cell: id, content, output: textOf(content), trace, ...(diagnostics ? { diagnostics } : {}), ...(errors.length ? { error: errors.join("\n") } : {}) });
				});
			};
			const detach = () => {
				cell.detached = true;
				const content: ContentBlock[] = [];
				const pending: string[] = [];
				for (const [call, record] of ordered()) {
					const handle = `c${id}.${call}`;
					if (!record.done) { pending.push(handle); continue; }
					content.push({ type: "text", text: `[${handle}]\n` }, ...record.content);
					if (record.error) content.push({ type: "text", text: record.error + "\n" });
				}
				const status = `c${id} running${pending.length ? `; pending ${pending.join(", ")}` : ""}. ` + (cell.passive
					? "Detached on interrupt: later output is delivered with the next result but will not wake the agent."
					: `Later output arrives by handle at the next tool result, or wakes you if idle. Do other work meanwhile; wait("c${id}") blocks.`);
				content.push({ type: "text", text: status + "\n" });
				settle({ content, running: true });
			};
			const cell: CellRun = {
				id, trace: { entries: [], omitted: 0, truncated: false, finished: false }, onUpdate: options.onUpdate,
				calls: new Map(), diagnostics: "", bytes: 0, detached: false, passive: false,
				check: () => {
					if (resolved) return;
					if (options.signal?.aborted) { cell.passive = true; void this.probe(); return detach(); }
					if (options.detach?.()) return detach();
					if (Date.now() - started >= yieldMs && ![...cell.calls.values()].some(call => call.sync && !call.done)) detach();
				},
				finish: (error?: string) => {
					if (this.cells.get(id) !== cell) return;
					this.cells.delete(id);
					cell.trace = { ...cell.trace, finished: true };
					const extra = cell.calls.get(0)?.content ?? [];
					if (!resolved) {
						const content = [...ordered().flatMap(([, record]) => record.content), ...extra];
						return settle({ content, ...(error ? { error } : {}) });
					}
					if (!cell.detached) return;
					const reported = ordered().some(([, record]) => record.error && record.error === error);
					const failed = Boolean(error && !reported);
					this.late({ handle: `c${id}`, content: mergeText([{ type: "text", text: failed ? "" : "done\n" }, ...extra]), ...(failed ? { error } : {}), passive: cell.passive || !failed });
				},
			};
			this.cells.set(id, cell);
			this.updateTrace(cell);
			options.signal?.addEventListener("abort", cell.check, { once: true });
			timer = setInterval(cell.check, Math.max(20, Math.min(200, yieldMs)));
			try {
				void this.start().then(() => {
					if (this.cells.get(id) !== cell) return;
					started = Date.now();
					this.child?.send({ type: "execute", id, code, query: options.query ?? "" }, (error) => {
						if (error) cell.finish(String(error));
					});
				}, (error) => cell.finish(String(error)));
			} catch (error) { cell.finish(String(error)); }
		});
	}

	private updateTrace(cell: CellRun): void {
		if (!cell.onUpdate || cell.detached) return;
		try { cell.onUpdate(structuredClone(cell.trace)); } catch { /* Presentation cannot affect execution. */ }
	}

	/** Abort every in-flight host service call; its promise must settle so host work unwinds. */
	private abortCalls(): void {
		for (const controller of this.calls) controller.abort();
		this.calls.clear();
	}

	private async stop(error: string): Promise<void> {
		const child = this.child;
		this.child = undefined;
		this.ready = undefined;
		this.abortCalls();
		for (const [pid, streams] of this.shellOutput) {
			for (const [stream, text] of streams) this.diagnostic(`
[interrupted shell ${pid} ${stream}; partial capture, up to 50 KiB]
${text}`);
		}
		this.shellOutput.clear();
		for (const cell of [...this.cells.values()]) {
			cell.trace = structuredClone(cell.trace);
			cell.trace.finished = true;
			for (const entry of cell.trace.entries) if (entry.state === "pending") {
				entry.state = "interrupted";
				entry.durationMs = Date.now() - entry.startedAt;
				entry.error = "Kernel stopped before completion";
			}
			this.updateTrace(cell);
			cell.finish(error);
		}
		if (!child?.pid) return;
		const exited = child.exitCode !== null || child.signalCode !== null;
		const closed = exited ? Promise.resolve() : new Promise<void>((resolve) => child.once("exit", () => resolve()));
		try {
			if (process.platform === "win32") {
				const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
				killer.on("error", () => child.kill("SIGKILL"));
			} else process.kill(-child.pid, "SIGKILL");
		} catch { child.kill("SIGKILL"); }
		await closed;
	}

	/** Stop the kernel process, its shells and host calls; the next cell starts a fresh kernel. */
	restart(reason = "Kernel restarted; state was cleared"): Promise<void> {
		return this.stop(reason);
	}

	async dispose(): Promise<void> {
		this.disposed = true;
		await this.stop("Kernel disposed; state was cleared");
		await this.persistence;
	}
}
