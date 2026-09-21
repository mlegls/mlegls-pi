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
}

export interface KernelNotification extends KernelResult {
	label?: string;
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
	onNotification?: (event: KernelNotification) => void;
	onIngress?: (event: IngressEvent) => void;
	/** Host-side implementation of the `exa` / `board` / `wm` namespaces. Must resolve JSON-serializable values. */
	call?: (request: KernelRequest) => Promise<unknown>;
}

const DEFAULT_MODULES = ["fs", "sh", "exa", "board", "wm", "term", "ui"];

const LIMIT = 50 * 1024;
const TRUNCATED = "\n[output truncated]\n";

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Persistent explicit state with cell-local scope in a disposable Node process. Not a security sandbox. */
export class Kernel {
	private child?: ChildProcess;
	private ready?: Promise<void>;
	private queue: Promise<unknown> = Promise.resolve();
	private persistence: Promise<void> = Promise.resolve();
	private persistenceError?: string;
	private entries = new Map<string, LedgerEntry>();
	private calls = new Set<AbortController>();
	private shellOutput = new Map<number, Map<string, string>>();
	private active?: { trace: KernelTrace; onUpdate?: (trace: KernelTrace) => void; id: number; content: ContentBlock[]; output: string; diagnostics: string; bytes: number; truncated: boolean; finish: (error?: string) => void };
	private sequence = 0;
	private disposed = false;

	constructor(private readonly options: KernelOptions) {
		for (const entry of options.ledger) this.entries.set(entry.path, entry);
	}

	execute(code: string, signal?: AbortSignal, onUpdate?: (trace: KernelTrace) => void, timeoutMs = 30_000, query = ""): Promise<KernelResult> {
		if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
			return Promise.resolve({ content: [], output: "", error: "timeoutMs must be an integer between 1 and 2147483647" });
		}
		const run = this.queue.then(() => this.run(code, signal, onUpdate, timeoutMs, query));
		this.queue = run.catch(() => {});
		return run;
	}

	private append(text: string, warning = false): void {
		const active = this.active;
		if (!active || (active.truncated && !warning)) return;
		const before = active.output.length;
		const bytes = Buffer.from(text);
		const remaining = warning ? bytes.length : LIMIT - active.bytes;
		active.output += bytes.subarray(0, remaining).toString();
		if (!warning) active.bytes += Math.min(bytes.length, remaining);
		if (bytes.length > remaining) {
			active.truncated = true;
			active.output += TRUNCATED;
		}
		const added = active.output.slice(before);
		const last = active.content.at(-1);
		if (last?.type === "text") last.text += added;
		else if (added) active.content.push({ type: "text", text: added });
	}

	private diagnostic(text: string): void {
		if (this.active) this.active.diagnostics = (this.active.diagnostics + text).slice(0, LIMIT);
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
					case "output": if (message.id === this.active?.id) this.append(message.text, message.warning); break;
					case "shell-output": {
						let streams = this.shellOutput.get(message.shell);
						if (!streams) this.shellOutput.set(message.shell, streams = new Map());
						streams.set(message.stream, (streams.get(message.stream) ?? "") + message.text);
						break;
					}
					case "shell-done": this.shellOutput.delete(message.shell); break;
					case "image": if (message.id === this.active?.id) this.active?.content.push({ type: "image", data: message.data, mimeType: message.mimeType }); break;
					case "trace":
						if (this.active && message.id === this.active.id) {
							this.active.trace = message.trace;
							this.updateTrace();
						}
						break;
					case "done": if (message.id === this.active?.id) this.active?.finish(message.error); break;
					case "request": void this.handleRequest(child, message); break;
					case "persist": {
						const entry = message.entry as LedgerEntry;
						this.entries.set(entry.path, entry);
						this.persistence = this.persistence.then(() => this.options.persist(entry)).catch((error) => {
							this.persistenceError = `Ledger persistence failed: ${String(error)}`;
						});
						break;
					}
					case "notification":
						try { this.options.onNotification?.(message.event); } catch { /* UI delivery must not kill the kernel. */ }
						break;
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
		if ((this.options.profile === "reader" && message.namespace !== "exa") || !(this.options.modules ?? DEFAULT_MODULES).includes(message.namespace)) {
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

	private async run(code: string, signal: AbortSignal | undefined, onUpdate: ((trace: KernelTrace) => void) | undefined, timeoutMs: number, query: string): Promise<KernelResult> {
		if (this.disposed) return { content: [], output: "", error: "Kernel is disposed" };
		if (signal?.aborted) return { content: [], output: "", error: "Execution cancelled" };
		return new Promise<KernelResult>((resolve) => {
			let finished = false;
			let timer: ReturnType<typeof setTimeout> | undefined;
			const id = ++this.sequence;
			const finish = (error?: string) => {
				if (finished) return;
				finished = true;
				clearTimeout(timer);
				signal?.removeEventListener("abort", abort);
				const trace = this.active?.trace;
				if (trace) trace.finished = true;
				const output = this.active?.output ?? "";
				const diagnostics = this.active?.diagnostics;
				const content = this.active?.content ?? [];
				this.active = undefined;
				void this.persistence.then(() => {
					const errors = [error, this.persistenceError].filter(Boolean);
					this.persistenceError = undefined;
					resolve({ output, content, trace, ...(diagnostics ? { diagnostics } : {}), ...(errors.length ? { error: errors.join("\n") } : {}) });
				});
			};
			const abort = () => { void this.stop("Execution cancelled; kernel state was cleared"); };
			this.active = { id, trace: { entries: [], omitted: 0, truncated: false, finished: false }, onUpdate, content: [], output: "", diagnostics: "", bytes: 0, truncated: false, finish };
			this.updateTrace();
			signal?.addEventListener("abort", abort, { once: true });
			timer = setTimeout(() => {
				void this.stop(`Execution timed out after ${timeoutMs}ms; kernel state was cleared and shell subprocesses stopped. Captured partial output is included (bounded); side effects may remain, so do not blindly retry. Use term for long suites/clones, set timeoutMs on this call, or retain a promise and await it in a later cell.`);
			}, timeoutMs);
			try {
				void this.start().then(() => {
					if (finished) return;
					this.child?.send({ type: "execute", id, code, query }, (error) => {
						if (error) void this.stop(String(error));
					});
				}, (error) => finish(String(error)));
			} catch (error) { finish(String(error)); }
		});
	}

	private updateTrace(): void {
		const active = this.active;
		if (!active?.onUpdate) return;
		try { active.onUpdate(structuredClone(active.trace)); } catch { /* Presentation cannot affect execution. */ }
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
		if (this.active) {
			this.active.trace = structuredClone(this.active.trace);
			this.active.trace.finished = true;
			for (const entry of this.active.trace.entries) if (entry.state === "pending") {
				entry.state = "interrupted";
				entry.durationMs = Date.now() - entry.startedAt;
				entry.error = "Kernel stopped before completion";
			}
			this.updateTrace();
		}
		this.active?.finish(error);
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

	async dispose(): Promise<void> {
		this.disposed = true;
		await this.stop("Kernel disposed; state was cleared");
		await this.persistence;
	}
}
