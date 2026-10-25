// wm: interactive worker threads, with turn reports from bb.
// Handles/topics name work and bb thread ids name lifetimes.
// Worktree and Git lifecycle belong to lib/thread.
//   const w = await spawn({ run: "orch/1726", handle: "unit-a", prompt, model, effort });
//   const o = await w.done;                        // resolves on done, rejects on exit
//   for await (const o of w.events) { ... }        // every event, incl. blocked/idle
//   const got = await wait([a, b], { mode: "all" }); // Map<Worker, Outcome> across several
//   await merge(w); await w.close();
//
// CLI: bun wm.ts spawn|next|done|send|capture|merge|close|status|agents ...

import { execFile } from "node:child_process";
import { agent, AGENTS_DIR, roleBody, type Agent } from "./agents.ts";
export { agent, AGENTS_DIR, type Agent } from "./agents.ts";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { abandonThread, historyThread, integrateThread, newThread, workerOf, ThreadMergeConflict, type WorkerCheckout, type WorkerThread } from "./thread";
import { bbThreads, bbWorkerThread, bbWorking, tellBb, type BbThread } from "./thread/bb";
import { commonDir } from "./thread/git";
import { lastTurn, type TurnReport } from "./thread/turn";

export type Outcome =
	| { kind: "done" | "blocked" | "needs-input" | "checkpoint"; message: TurnReport } // checkpoint: fenced on context; paused for a follow-up like needs-input
	| { kind: "idle"; tail: string; message?: TurnReport } // turn ended without a status: its final message
	| { kind: "exited"; tail: string }; // pi process gone

export interface SpawnOptions {
	run: string; // names the run the worker belongs to, e.g. orch/1726 or orch/rework-auth
	handle: string;
	prompt: string;
	model?: string; // routed provider/model; required, with effort
	effort?: string;
	agent?: string; // name of a stance file in AGENTS_DIR
	role?: string; // which of the agent's roles this spawn fills (default: its first)
	base?: string; // git ref to branch from
	prepare?: (cwd: string) => Promise<string | void>; // before setup/launch; may replace the task prompt
	cwd?: string; // repo; default process.cwd()
	session?: string; // legacy receipt field; never selects a transport
	parentSession?: string; // pi session id that spawned the worker; default PI_SESSION_ID
	parentSessionFile?: string; // session jsonl that from: "summary" extracts from
	from?: "summary"; // prepend an extract of the parent session to the prompt
}

function contentText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map((c) => (c && typeof c === "object" && (c as { type?: string }).type === "text" ? String((c as { text?: string }).text ?? "") : "")).filter(Boolean).join("\n");
}

/** Compaction summaries if present, else user-message text. Truncated. */
export function parentSummary(file: string, max = 12_000): string {
	const comps: string[] = [];
	const users: string[] = [];
	for (const line of readFileSync(file, "utf8").split("\n")) {
		if (!line) continue;
		let e: { type?: string; summary?: string; message?: { role?: string; content?: unknown } };
		try { e = JSON.parse(line); } catch { continue; }
		if (e.type === "compaction" && e.summary) comps.push(e.summary);
		if (e.type === "message" && e.message?.role === "user") {
			const t = contentText(e.message.content);
			if (t) users.push(t);
		}
	}
	const text = (comps.length ? comps : users).join("\n\n");
	return text.length <= max ? text : `${text.slice(0, max)}\n…`;
}

const TERMINAL = ["done", "blocked", "needs-input", "checkpoint"] as const;
const POLL_MS = 1_000;

export function pidAlive(pid: number): boolean {
	try { process.kill(pid, 0); return true; }
	catch (error) { if ((error as { code?: string }).code === "ESRCH") return false; throw error; }
}

interface Result {
	exitCode: number;
	stdout: string;
	stderr: string;
}

/** Run a command without a shell; never throws, the exit code says. */
function sh(cmd: string, args: string[], cwd?: string): Promise<Result> {
	return new Promise((res) => {
		execFile(cmd, args, { cwd, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
			const code = err && "code" in err && typeof err.code === "number" ? err.code : err ? 1 : 0;
			res({ exitCode: code, stdout: String(stdout), stderr: String(stderr) });
		});
	});
}

/** The reporting preamble every worker gets: `AGENTS_DIR/_common.md` with {{run}} {{handle}} {{topic}} filled. */
export function common(run: string, handle: string): string {
	const file = join(AGENTS_DIR, "_common.md");
	return fill(existsSync(file) ? readFileSync(file, "utf8") : "report by ending your turn with done, blocked, or needs-input as its first word.", run, handle);
}

/** {{run}} {{handle}} {{topic}} in agent bodies and _common. */
function fill(text: string, run: string, handle: string): string {
	return text.replaceAll("{{run}}", run).replaceAll("{{handle}}", handle).replaceAll("{{topic}}", `${run}/${handle}`).trim();
}

/** Universal preamble, then the role's procedure, then the agent's competency, then the task. */
export function prompt(o: { run: string; handle: string; prompt: string; agent?: Agent; role?: string }): string {
	const role = o.role ?? o.agent?.roles[0];
	return [common(o.run, o.handle), role && fill(roleBody(role), o.run, o.handle), o.agent && fill(o.agent.body, o.run, o.handle), o.prompt].filter(Boolean).join("\n\n---\n\n");
}

/** Env exported into the worker's agent command: identity, spawn provenance, and the fence's checkpoint ratio. */
export function spawnEnv(o: { run: string; handle: string; agent?: string; parentSession?: string; checkpoint?: string }): string[] {
	return [
		o.agent && `PI_WM_AGENT=${o.agent}`,
		`PI_WM_RUN=${o.run}`,
		`PI_WM_HANDLE=${o.handle}`,
		o.parentSession && `PI_WM_PARENT_SESSION=${o.parentSession}`,
		o.checkpoint && `PI_CHECKPOINT=${o.checkpoint}`,
		process.env.PI_CODING_AGENT_DIR && `PI_CODING_AGENT_DIR=${process.env.PI_CODING_AGENT_DIR}`,
	].filter((v): v is string => Boolean(v));
}



/** One poller per process: bb turn completions + batched thread observations. Ticks only while awaited. */
class Poller {
	private workers = new Set<Worker>();
	private timer?: ReturnType<typeof setTimeout>;
	private running = false;
	private errors = new Map<string, string>();
	private defer(key: string, error: unknown) {
		const message = String(error);
		if (this.errors.get(key) !== message) console.error("wm poll deferred (" + key + "): " + message);
		this.errors.set(key, message);
	}

	add(w: Worker) {
		this.workers.add(w);
	}
	remove(w: Worker) {
		this.workers.delete(w);
		this.errors.delete(w.topic);
		if (![...this.workers].some(w => w.awaited)) { clearTimeout(this.timer); this.timer = undefined; }
	}
	/** @internal called when a worker gains a waiter or listener */
	schedule() {
		if (this.timer || ![...this.workers].some((w) => w.awaited)) return;
		this.timer = setTimeout(() => {
			this.timer = undefined;
			void this.tick().catch(error => this.defer("poll", error)).finally(() => this.schedule());
		}, POLL_MS);
	}
	private async tick() {
		if (this.running) return;
		this.running = true;
		try {
			if (![...this.workers].some(w => w.awaited)) return;
			for (const w of this.workers) {
				try { if (w.awaited && !w.launching) await w.turn(); }
				catch (error) { this.defer(w.topic, error); }
			}
			const threads = await bbThreads();
			for (const w of this.workers) {
				try {
					if (w.awaited && !w.launching) await w.observe(threads);
					this.errors.delete(w.topic);
				} catch (error) { this.defer(w.topic, error); }
			}
			this.errors.delete("poll");
		} finally {
			this.running = false;
		}
	}
}

const poller = new Poller();

export class Worker {
	readonly topic: string;
	dir: string;
	/** The worker's bb thread: bound at spawn, or found from run state or by its title `<run>/<handle>`. */
	bb?: string;
	private owningBranch?: string;
	/** @internal Register before launch; host observation starts once bb has launched it. */
	launching = false;
	private listeners = new Set<(o: Outcome) => void>();
	private waiters: Array<(o: Outcome) => void> = [];
	private unread: Outcome[] = []; // events that arrived while nobody was listening; the next `next()` takes them first
	/** The bb log position after the last turn this worker reported; unset on a reattached worker until its first look. */
	turnCursor?: number;
	/** @internal Report a turn that completed since the last look: the worker's final message, its status the first word. */
	async turn() {
		if (this.ended) return;
		const bb = await this.bbId();
		if (!bb) return;
		if (this.turnCursor === undefined) { this.turnCursor = (await lastTurn(bb))?.seq ?? 0; return; }
		const report = await lastTurn(bb, this.turnCursor);
		if (!report) return;
		this.turnCursor = report.seq;
		const tag = TERMINAL.find(t => report.tags.includes(t));
		this.emit(tag ? { kind: tag, message: report } : { kind: "idle", tail: report.body, message: report });
	}
	/** @internal */
	get awaited() {
		return this.waiters.length > 0 || this.listeners.size > 0;
	}
	private ended?: Outcome;

	constructor(
		readonly run: string,
		readonly handle: string,
		readonly cwd: string,
		readonly session = "", // legacy, not transport or canonical pi identity
		dir = cwd,
		bb?: string,
	) {
		this.topic = `${run}/${handle}`;
		this.dir = dir;
		this.bb = bb;
		poller.add(this);
	}

	/** @internal spawn failed; detach without closing a worktree. */
	drop() {
		poller.remove(this);
	}

	/** @internal The worker's bb thread, from what it was attached with or else bb by title; no worktree/window-name guesses. */
	async bbId(): Promise<string | undefined> {
		if (this.bb) return this.bb;
		return this.bb ??= bbWorkerThread(await bbThreads(), this.handle, this.run)?.id;
	}
	/** @internal The worker's live thread (its bb thread and worktree), or undefined once it is archived. */
	async record(): Promise<WorkerThread | undefined> {
		const bb = await this.bbId();
		const thread = bb ? await workerOf(bb, { run: this.run, handle: this.handle }) : undefined;
		if (thread) this.bind(thread);
		return thread;
	}
	/** @internal */
	bind(thread: WorkerThread) {
		this.bb = thread.id;
		this.dir = thread.cwd;
		this.owningBranch = thread.branch;
	}
	private async id(): Promise<string> {
		const record = await this.record();
		if (!record) throw new Error("No live worker " + this.topic);
		return record.id;
	}

	get branch() {
		return this.owningBranch ?? this.handle;
	}

	/** @internal */
	emit(o: Outcome) {
		if (this.ended) return;
		if (o.kind === "exited") {
			this.ended = o;
			poller.remove(this);
		}
		if (!this.awaited) this.unread.push(o);
		for (const resolve of this.waiters.splice(0)) resolve(o);
		for (const l of this.listeners) l(o);
	}

	/** @internal */
	async observe(threads: Map<string, BbThread>) {
		if (this.ended || this.launching) return;
		const bb = await this.bbId();
		const entry = bb ? threads.get(bb) : undefined;
		// Only bb's state counts: it may release an idle worker's pi without ending the thread.
		if (!entry || entry.archivedAt) this.emit({ kind: "exited", tail: "Thread agent is gone: " + (bb ?? this.topic) });
	}

	/** Next event of any kind. After exit, always the exit outcome. Aborting the signal withdraws the wait without consuming anything. */
	next(signal?: AbortSignal): Promise<Outcome> {
		if (this.unread.length) return Promise.resolve(this.unread.shift()!);
		if (this.ended) return Promise.resolve(this.ended);
		return new Promise((resolve, reject) => {
			const done = (o: Outcome) => {
				signal?.removeEventListener("abort", abort);
				resolve(o);
			};
			const abort = () => {
				this.waiters = this.waiters.filter((w) => w !== done);
				reject(signal!.reason ?? new Error("aborted"));
			};
			signal?.addEventListener("abort", abort, { once: true });
			this.waiters.push(done);
			poller.schedule();
		});
	}

	/** Every event, as a fresh iterator per access. Ends after `exited`. */
	get events(): AsyncGenerator<Outcome> {
		const queue: Outcome[] = [];
		let wake: (() => void) | undefined;
		const listener = (o: Outcome) => {
			queue.push(o);
			wake?.();
		};
		this.listeners.add(listener);
		poller.schedule();
		const self = this;
		return (async function* () {
			try {
				while (true) {
					if (queue.length === 0) {
						if (self.ended) return;
						await new Promise<void>((r) => (wake = r));
						wake = undefined;
					}
					const o = queue.shift()!;
					yield o;
					if (o.kind === "exited") return;
				}
			} finally {
				self.listeners.delete(listener);
			}
		})();
	}

	/** Resolves on `done`; rejects on `exited`; waits through everything else. */
	get done(): Promise<Outcome> {
		return (async () => {
			while (true) {
				const o = await this.next();
				if (o.kind === "done") return o;
				if (o.kind === "exited") throw new WorkerExited(this, o);
			}
		})();
	}

	async send(text: string) {
		await tellBb(await this.id(), text);
	}

	async capture(lines = 50): Promise<string> {
		return historyThread(await this.id(), lines);
	}

	async exec(cmd: string[]) {
		await this.id();
		return sh(cmd[0]!, cmd.slice(1), this.dir);
	}

	async status(): Promise<string | undefined> {
		const bb = await this.bbId();
		const entry = bb ? (await bbThreads()).get(bb) : undefined;
		return !entry || entry.archivedAt ? undefined : bbWorking(entry) ? "working" : "idle";
	}

	/** Abandon the registered subtree; polling detaches only after successful cleanup. */
	async close(keepBranch = false, options: { discardIgnored?: boolean } = {}) {
		const result = await abandonThread(await this.id(), { keepBranch, discardIgnored: options.discardIgnored });
		this.emit({ kind: "exited", tail: "" });
		poller.remove(this);
		return result;
	}

	toJSON() {
		return { run: this.run, handle: this.handle, topic: this.topic, dir: this.dir, cwd: this.cwd, session: this.session, bb: this.bb };
	}
}

export class WorkerExited extends Error {
	constructor(readonly worker: Worker, readonly outcome: Outcome) {
		super(`${worker.handle} exited without reporting`);
	}
}

export interface WaitOptions {
	mode?: "any" | "all"; // any: the first event among them; all: one event per worker
	timeoutMs?: number;
	signal?: AbortSignal;
}

/** Wait on several workers at once. Returns the outcomes that arrived, keyed by worker; the missing ones are still pending. */
export async function wait(workers: Worker[], opts: WaitOptions = {}): Promise<Map<Worker, Outcome>> {
	const mode = opts.mode ?? "any";
	const got = new Map<Worker, Outcome>();
	if (!workers.length) return got;
	const ac = new AbortController();
	const stop = () => ac.abort();
	const timer = opts.timeoutMs !== undefined ? setTimeout(stop, opts.timeoutMs) : undefined;
	opts.signal?.addEventListener("abort", stop, { once: true });
	await Promise.all(
		workers.map((w) =>
			w.next(ac.signal).then(
				(o) => {
					got.set(w, o);
					if (mode === "any" || got.size === workers.length) stop();
				},
				() => {}, // withdrawn: still pending
			),
		),
	);
	clearTimeout(timer);
	opts.signal?.removeEventListener("abort", stop);
	return got;
}

export class MergeConflict extends Error {
	constructor(readonly worker: Worker, readonly files: string[]) {
		super(`${worker.handle}: conflicts in ${files.join(", ")}`);
	}
}

/** Workers write scratch under `.wm/<handle>/`; keep it out of every worktree's status without touching .gitignore. */
async function excludeWm(cwd: string) {
	const r = await sh("git", ["rev-parse", "--git-common-dir"], cwd);
	if (r.exitCode !== 0) return;
	const file = resolve(cwd, r.stdout.trim(), "info", "exclude");
	const cur = existsSync(file) ? readFileSync(file, "utf8") : "";
	if (cur.split("\n").includes(".wm/")) return;
	const { mkdirSync, appendFileSync } = await import("node:fs");
	mkdirSync(resolve(file, ".."), { recursive: true });
	appendFileSync(file, `${cur.endsWith("\n") || cur === "" ? "" : "\n"}.wm/\n`);
}

export async function spawn(o: SpawnOptions): Promise<Worker> {
	const a = o.agent ? agent(o.agent) : undefined;
	if (o.agent && !a) throw new Error("Unknown agent stance: " + o.agent);
	if ((o as { command?: unknown }).command !== undefined) throw new Error("wm.spawn runs pi as a bb thread; a worker command is not supported");
	if (!o.model?.includes("/") || !o.effort) throw new Error("wm.spawn requires routed model (provider/model) and effort");
	const cwd = resolve(o.cwd ?? process.cwd());
	await excludeWm(cwd);
	const w = new Worker(o.run, o.handle, cwd, o.session);
	w.launching = true;
	try {
		let text = o.prompt;
		if (o.from === "summary") {
			const file = o.parentSessionFile ?? process.env.PI_SESSION_FILE;
			if (file && existsSync(file)) text = [parentSummary(file), o.prompt].filter(Boolean).join("\n\n---\n\n");
		} else if (o.from) {
			throw new Error(`from must be "summary"; bb threads cannot fork a session`);
		}
		const env = Object.fromEntries(spawnEnv({ run: o.run, handle: o.handle, agent: a?.name, parentSession: o.parentSession ?? process.env.PI_SESSION_ID, checkpoint: a?.checkpoint }).map(s => { const i = s.indexOf("="); return [s.slice(0, i), s.slice(i + 1)]; }));
		const options = { cwd, worktree: o.handle, base: o.base, prepare: o.prepare ? async (thread: WorkerCheckout) => {
			const prepared = await o.prepare!(thread.cwd);
			if (prepared !== undefined) thread.launch!.prompt = prompt({ ...o, prompt: prepared, agent: a });
		} : undefined, worker: { run: o.run, handle: o.handle },
			launch: { args: ["--approve", "--model", o.model!, "--thinking", o.effort!], env, prompt: prompt({ ...o, prompt: text, agent: a }) } };
		w.bind(await newThread(options));
		w.turnCursor = 0;
		w.launching = false;
		return w;
	} catch (err) {
		w.drop();
		throw err;
	}
}

/** A Worker spawned elsewhere. Its thread and path resolve from bb (the given thread id, else the title `<run>/<handle>`) on first use. */
export function attach(run: string, handle: string, cwd = process.cwd(), session = "", bb?: string): Worker {
	return new Worker(run, handle, resolve(cwd), session, resolve(cwd), bb);
}

/** Raw integration follows the branch's recorded ab-parent; never retires or sends mail. */
export async function merge(w: Worker, opts: { into?: string; mode?: "merge" | "rebase" } = {}) {
	const record = await w.record();
	if (!record) throw new Error("No live worker " + w.topic);
	if (opts.into) {
		const parent = await sh("git", ["config", "--get", "branch." + record.branch + ".ab-parent"], record.project);
		if (parent.stdout.trim() !== opts.into) throw new Error("merge destination is recorded ab-parent, not " + opts.into);
	}
	try { return await integrateThread(record.id, { mode: opts.mode }); }
	catch (error) { if (error instanceof ThreadMergeConflict) throw new MergeConflict(w, error.files); throw error; }
}

if (import.meta.main) {
	const [cmd, ...rest] = process.argv.slice(2);
	const opt = (name: string) => {
		const i = rest.indexOf(`--${name}`);
		return i >= 0 ? rest[i + 1] : undefined;
	};
	const pos = rest.filter((a, i) => !a.startsWith("--") && !rest[i - 1]?.startsWith("--"));
	const need = (v: string | undefined, n: string) => {
		if (!v) throw new Error(`--${n} required`);
		return v;
	};
	const at = (run: string, handle: string) => attach(run, handle, process.cwd(), opt("session"));
	const print = (v: unknown) => console.log(JSON.stringify(v, null, 2));
	switch (cmd) {
		case "spawn": {
			const promptFile = opt("prompt-file");
			const prompt = promptFile ? readFileSync(promptFile, "utf8") : need(opt("prompt"), "prompt");
			const w = await spawn({ run: need(opt("run"), "run"), handle: need(pos[0], "handle"), prompt, model: opt("model"), effort: opt("effort"), agent: opt("agent"), base: opt("base"), session: opt("session"), from: opt("from") as "summary" | undefined, parentSessionFile: process.env.PI_SESSION_FILE });
			print(w);
			process.exit(0);
		}
		case "next":
		case "done": {
			const w = at(need(opt("run"), "run"), need(pos[0], "handle"));
			print(cmd === "next" ? await w.next() : await w.done);
			process.exit(0);
		}
		case "send": {
			const w = at(need(opt("run"), "run"), need(pos[0], "handle"));
			await w.send(need(pos[1], "text"));
			process.exit(0);
		}
		case "capture": {
			const w = at(need(opt("run"), "run"), need(pos[0], "handle"));
			console.log(await w.capture(Number(opt("lines") ?? 50)));
			process.exit(0);
		}
		case "merge": {
			const w = at(need(opt("run"), "run"), need(pos[0], "handle"));
			await merge(w, { into: opt("into"), mode: opt("mode") as "merge" | "rebase" | undefined });
			process.exit(0);
		}
		case "close": {
			await at(need(opt("run"), "run"), need(pos[0], "handle")).close(rest.includes("--keep-branch"));
			process.exit(0);
		}
		case "status": {
			const here = commonDir(process.cwd());
			print([...(await bbThreads()).values()].filter(t => !t.archivedAt && t.title?.includes("/") && t.environmentPath && commonDir(t.environmentPath) === here)
				.map(t => ({ bb: t.id, worker: t.title, status: t.status, path: t.environmentPath })));
			process.exit(0);
		}
		case "agents": {
			const { readdirSync } = await import("node:fs");
			for (const f of readdirSync(AGENTS_DIR).sort()) {
				if (!f.endsWith(".md") || f.startsWith("_")) continue;
				const d = /^description:\s*(.*)$/m.exec(readFileSync(join(AGENTS_DIR, f), "utf8"))?.[1] ?? "";
				console.log(`- \`${f.slice(0, -3)}\`: ${d}`);
			}
			process.exit(0);
		}
		default:
			console.error("usage: wm.ts spawn <handle> --run R (--prompt P | --prompt-file F) --model provider/model --effort E [--agent A] [--base B] [--from summary]\n       wm.ts next|done|capture|merge|close <handle> --run R\n       wm.ts send <handle> <text> --run R\n       wm.ts status | agents");
			process.exit(2);
	}
}
