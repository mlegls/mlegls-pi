import { fork, spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { LedgerEntry } from "../outline-read/ledger";

export interface KernelResult {
	output: string;
	error?: string;
}

export interface KernelNotification extends KernelResult {
	label?: string;
}

export interface KernelOptions {
	cwd: string;
	ledger: LedgerEntry[];
	persist: (entry: LedgerEntry) => void | Promise<void>;
	onNotification?: (event: KernelNotification) => void;
}

const LIMIT = 50 * 1024;
const TRUNCATED = "\n[output truncated]\n";

/** Persistent lexical scope in a disposable Node process. Not a security sandbox. */
export class Kernel {
	private child?: ChildProcess;
	private ready?: Promise<void>;
	private queue: Promise<unknown> = Promise.resolve();
	private persistence: Promise<void> = Promise.resolve();
	private persistenceError?: string;
	private entries = new Map<string, LedgerEntry>();
	private active?: { id: number; output: string; bytes: number; truncated: boolean; finish: (error?: string) => void };
	private sequence = 0;
	private disposed = false;

	constructor(private readonly options: KernelOptions) {
		for (const entry of options.ledger) this.entries.set(entry.path, entry);
	}

	execute(code: string, signal?: AbortSignal): Promise<KernelResult> {
		const run = this.queue.then(() => this.run(code, signal));
		this.queue = run.catch(() => {});
		return run;
	}

	private append(text: string): void {
		const active = this.active;
		if (!active || active.truncated) return;
		const bytes = Buffer.from(text);
		const remaining = LIMIT - active.bytes;
		active.output += bytes.subarray(0, remaining).toString();
		active.bytes += Math.min(bytes.length, remaining);
		if (bytes.length > remaining) {
			active.truncated = true;
			active.output += TRUNCATED;
		}
	}

	private start(): Promise<void> {
		if (this.ready) return this.ready;
		const require = createRequire(import.meta.url);
		let loader: string;
		try { loader = require.resolve("jiti"); }
		catch { loader = createRequire(require.resolve("@earendil-works/pi-coding-agent")).resolve("jiti"); }
		const child = fork(fileURLToPath(new URL("./runtime.cjs", import.meta.url)), [], {
			cwd: this.options.cwd,
			execPath: process.versions.bun ? "node" : process.execPath,
			execArgv: [],
			detached: process.platform !== "win32",
			stdio: ["ignore", "pipe", "pipe", "ipc"],
		});
		this.child = child;
		child.stdout?.setEncoding("utf8").on("data", (text) => { if (this.child === child) this.append(text); });
		child.stderr?.setEncoding("utf8").on("data", (text) => { if (this.child === child) this.append(text); });
		this.ready = new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error("Kernel startup timed out"));
				void this.stop("Kernel startup timed out");
			}, 15_000);
			child.on("message", (message: any) => {
				if (this.child !== child) return;
				switch (message.type) {
					case "ready": clearTimeout(timer); resolve(); break;
					case "output": if (message.id === this.active?.id) this.append(message.text); break;
					case "done": if (message.id === this.active?.id) this.active?.finish(message.error); break;
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
				const error = `Kernel exited (${signal ?? code}); bindings were reset`;
				reject(new Error(error));
				if (this.child === child) void this.stop(error);
			});
			child.send({ type: "init", cwd: this.options.cwd, ledger: [...this.entries.values()], loader });
		});
		return this.ready;
	}

	private async run(code: string, signal?: AbortSignal): Promise<KernelResult> {
		if (this.disposed) return { output: "", error: "Kernel is disposed" };
		if (signal?.aborted) return { output: "", error: "Execution cancelled" };
		return new Promise<KernelResult>((resolve) => {
			let finished = false;
			const id = ++this.sequence;
			const finish = (error?: string) => {
				if (finished) return;
				finished = true;
				signal?.removeEventListener("abort", abort);
				const output = this.active?.output ?? "";
				this.active = undefined;
				void this.persistence.then(() => {
					const errors = [error, this.persistenceError].filter(Boolean);
					this.persistenceError = undefined;
					resolve({ output, ...(errors.length ? { error: errors.join("\n") } : {}) });
				});
			};
			const abort = () => { void this.stop("Execution cancelled; kernel bindings were reset"); };
			this.active = { id, output: "", bytes: 0, truncated: false, finish };
			signal?.addEventListener("abort", abort, { once: true });
			try {
				void this.start().then(() => {
					if (finished) return;
					this.child?.send({ type: "execute", id, code }, (error) => {
						if (error) void this.stop(String(error));
					});
				}, (error) => finish(String(error)));
			} catch (error) { finish(String(error)); }
		});
	}

	private async stop(error: string): Promise<void> {
		const child = this.child;
		this.child = undefined;
		this.ready = undefined;
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
		await this.stop("Kernel disposed; bindings were reset");
		await this.persistence;
	}
}
