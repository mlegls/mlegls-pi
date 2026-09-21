// wm: spawn interactive pi workers in workmux worktrees and hear back through the board.
//
// A worker is one workmux worktree + tmux window running an agent (an AGENTS_DIR/<name>.md
// with a `runCommand`, or a raw command). Its `handle` is the
// branch, the worktree dir, the window, and the board sender name; it reports on
// board topic `<run>/<handle>` with tags done | blocked | needs-input | checkpoint. The tmux
// session is named after the run, so every worker of a run sits in one session.
//
//   const w = await spawn({ run: "compile/1726", handle: "unit-a", prompt });
//   const o = await w.done;                        // resolves on done, rejects on exit
//   for await (const o of w.events) { ... }        // every event, incl. blocked/idle
//   const got = await wait([a, b], { mode: "all" }); // Map<Worker, Outcome> across several
//   await merge(w); await w.close();
//
// CLI: bun wm.ts spawn|next|done|send|capture|merge|close|status|agents ...

import { execFile } from "node:child_process";
import { agent, AGENTS_DIR, type Agent } from "./agents.ts";
export { agent, AGENTS_DIR, type Agent } from "./agents.ts";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { logSize, readFrom, type Message } from "./board/store";

export type Outcome =
	| { kind: "done" | "blocked" | "needs-input" | "checkpoint"; message: Message } // checkpoint: fenced on context; paused for a follow-up like needs-input
	| { kind: "idle"; tail: string } // agent finished a turn without reporting
	| { kind: "exited"; tail: string }; // pi process gone

export interface SpawnOptions {
	run: string; // board topic prefix, e.g. compile/1726 or orch/rework-auth
	handle: string;
	prompt: string;
	command?: string; // explicit command override; keeps the named agent stance/checkpoint
	agent?: string; // name of an agent file in AGENTS_DIR, else a raw command for workmux -a
	base?: string; // git ref to branch from
	cwd?: string; // repo; default process.cwd()
	session?: string; // tmux session; default slug of run
	parentSession?: string; // pi session id that spawned the worker; default PI_SESSION_ID
	parentSessionFile?: string; // session jsonl; --fork needs the path because the child's cwd is a different project
	from?: "fork" | "summary"; // fork: pi --fork <parent>; summary: prepend an extract of the parent session to the prompt
}

/** Insert `--fork <source>` after the pi binary. Source should be the parent session file when the child cwd differs. */
export function withFork(cmd: string, source: string): string {
	if (/(?:^|\s)--fork(?:\s|$|=)/.test(cmd)) return cmd;
	const i = cmd.search(/\s/);
	const bin = i < 0 ? cmd : cmd.slice(0, i);
	if (basename(bin) !== "pi") throw new Error(`from: "fork" needs a pi runCommand, got ${cmd}`);
	const arg = /[\s"$\\]/.test(source) ? JSON.stringify(source) : source;
	return `${bin} --fork ${arg}${i < 0 ? "" : cmd.slice(i)}`;
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
const IDLE_GRACE_MS = 8_000;
const POLL_MS = 1_000;
const SHELLS = new Set(["zsh", "bash", "fish", "sh", "nu"]);

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

/** The board/reporting preamble every worker gets: `AGENTS_DIR/_common.md` with {{run}} {{handle}} {{topic}} filled. */
export function common(run: string, handle: string): string {
	const file = join(AGENTS_DIR, "_common.md");
	return fill(existsSync(file) ? readFileSync(file, "utf8") : "report on board topic {{topic}}: tag done, blocked, or needs-input.", run, handle);
}

/** {{run}} {{handle}} {{topic}} in agent bodies and _common. */
function fill(text: string, run: string, handle: string): string {
	return text.replaceAll("{{run}}", run).replaceAll("{{handle}}", handle).replaceAll("{{topic}}", `${run}/${handle}`).trim();
}

export function prompt(o: { run: string; handle: string; prompt: string; agent?: Agent }): string {
	return [o.agent && fill(o.agent.body, o.run, o.handle), o.prompt, common(o.run, o.handle)].filter(Boolean).join("\n\n---\n\n");
}

/** Env exported into the worker's agent command: board identity, spawn provenance, and the fence's checkpoint ratio. */
export function spawnEnv(o: { run: string; handle: string; agent?: string; parentSession?: string; checkpoint?: string }): string[] {
	return [
		`PI_BOARD_NAME=${o.handle}`,
		`PI_BOARD_TOPIC=${o.run}/${o.handle}`,
		o.agent && `PI_WM_AGENT=${o.agent}`,
		`PI_WM_RUN=${o.run}`,
		`PI_WM_HANDLE=${o.handle}`,
		o.parentSession && `PI_WM_PARENT_SESSION=${o.parentSession}`,
		o.checkpoint && `PI_CHECKPOINT=${o.checkpoint}`,
	].filter((v): v is string => Boolean(v));
}

function slug(s: string): string {
	return s.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
}

interface StatusEntry {
	worktree: string;
	branch: string;
	status: string;
	pane_id: string;
	workdir: string;
	session: string;
	updated_ts: number;
}

export async function workmuxStatus(cwd: string): Promise<StatusEntry[]> {
	const out = await sh("workmux", ["status", "--json"], cwd);
	if (out.exitCode !== 0) return [];
	try {
		return JSON.parse(out.stdout).agents ?? [];
	} catch {
		return [];
	}
}

async function livePanes(): Promise<Map<string, string>> {
	const out = await sh("tmux", ["list-panes", "-a", "-F", "#{pane_id} #{pane_current_command}"]);
	const map = new Map<string, string>();
	for (const line of out.stdout.split("\n")) {
		const [id, cmd] = line.split(" ");
		if (id) map.set(id, cmd ?? "");
	}
	return map;
}

/** One poller per process: board cursor + workmux status, fanned out to workers. Ticks only while some worker is awaited. */
class Poller {
	private workers = new Set<Worker>();
	private cursor = logSize();
	private timer?: ReturnType<typeof setTimeout>;
	private running = false;

	add(w: Worker) {
		this.workers.add(w);
	}
	remove(w: Worker) {
		this.workers.delete(w);
	}
	/** @internal called when a worker gains a waiter or listener */
	schedule() {
		if (this.timer || ![...this.workers].some((w) => w.awaited)) return;
		this.timer = setTimeout(() => {
			this.timer = undefined;
			void this.tick().finally(() => this.schedule());
		}, POLL_MS);
	}
	private async tick() {
		if (this.running) return;
		this.running = true;
		try {
			const { messages, offset } = readFrom(this.cursor);
			this.cursor = offset;
			for (const m of messages) {
				const tag = TERMINAL.find((t) => m.tags.includes(t));
				if (!tag) continue;
				for (const w of this.workers) if (w.topic === m.topic) w.emit({ kind: tag, message: m });
			}
			const byCwd = new Map<string, Promise<StatusEntry[]>>();
			const panes = await livePanes();
			for (const w of this.workers) {
				if (!byCwd.has(w.cwd)) byCwd.set(w.cwd, workmuxStatus(w.cwd));
				const entry = (await byCwd.get(w.cwd)!).find((e) => e.worktree === w.handle);
				await w.observe(entry, panes);
			}
		} finally {
			this.running = false;
		}
	}
}

const poller = new Poller();

export class Worker {
	readonly topic: string;
	dir: string;
	paneId?: string;
	private listeners = new Set<(o: Outcome) => void>();
	private waiters: Array<(o: Outcome) => void> = [];
	private unread: Outcome[] = []; // events that arrived while nobody was listening; the next `next()` takes them first
	/** @internal */
	get awaited() {
		return this.waiters.length > 0 || this.listeners.size > 0;
	}
	private ended?: Outcome;
	private idleSince?: number;
	private reportedAfterIdle = false;
	private lastReportTs = 0;
	private sawAgent = false; // pane has run something other than a shell, so a shell now means pi exited

	constructor(
		readonly run: string,
		readonly handle: string,
		readonly cwd: string,
		readonly session: string,
		dir: string,
	) {
		this.topic = `${run}/${handle}`;
		this.dir = dir;
		poller.add(this);
	}

	/** @internal spawn failed; detach without closing a worktree. */
	drop() {
		poller.remove(this);
	}

	get branch() {
		return this.handle;
	}

	/** @internal */
	emit(o: Outcome) {
		if (this.ended) return;
		if (o.kind !== "idle") {
			this.lastReportTs = Date.now();
			this.reportedAfterIdle = true;
		}
		if (o.kind === "exited") {
			this.ended = o;
			poller.remove(this);
		}
		if (!this.awaited) this.unread.push(o);
		for (const resolve of this.waiters.splice(0)) resolve(o);
		for (const l of this.listeners) l(o);
	}

	/** @internal */
	async observe(entry: StatusEntry | undefined, panes: Map<string, string>) {
		if (entry?.pane_id) this.paneId = entry.pane_id;
		if (this.paneId) {
			const cmd = panes.get(this.paneId);
			if (cmd !== undefined && !SHELLS.has(cmd)) this.sawAgent = true;
			else if (cmd === undefined || this.sawAgent) {
				this.emit({ kind: "exited", tail: await this.capture(30).catch(() => "") });
				return;
			}
		}
		if (!entry) return;
		if (entry.status === "working") {
			this.idleSince = undefined;
			this.reportedAfterIdle = false;
			return;
		}
		// status done/waiting: the agent ended a turn. Give the board a moment to carry its report.
		const changed = entry.updated_ts * 1000;
		if (this.idleSince === undefined) this.idleSince = Math.max(changed, Date.now());
		if (this.reportedAfterIdle || this.lastReportTs >= changed - 2_000) return;
		if (Date.now() - this.idleSince >= IDLE_GRACE_MS) {
			this.reportedAfterIdle = true; // one idle event per quiet turn
			this.emit({ kind: "idle", tail: await this.capture(30).catch(() => "") });
		}
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
		this.idleSince = undefined;
		this.reportedAfterIdle = false;
		const r = await sh("workmux", ["send", this.handle, text], this.cwd);
		if (r.exitCode !== 0) throw new Error(`workmux send ${this.handle} failed:\n${r.stderr || r.stdout}`);
	}

	async capture(lines = 50): Promise<string> {
		if (!this.paneId) return "";
		const out = await sh("tmux", ["capture-pane", "-p", "-t", this.paneId]);
		const all = out.stdout.replace(/\s+$/, "").split("\n");
		return all.slice(-lines).join("\n");
	}

	async exec(cmd: string[]) {
		return await sh("workmux", ["run", this.handle, "--", ...cmd], this.cwd);
	}

	async status(): Promise<string | undefined> {
		return (await workmuxStatus(this.cwd)).find((e) => e.worktree === this.handle)?.status;
	}

	/** Remove worktree, window, and branch. */
	async close(keepBranch = false) {
		poller.remove(this);
		this.ended ??= { kind: "exited", tail: "" };
		await sh("workmux", ["rm", this.handle, "-f", ...(keepBranch ? ["-k"] : [])], this.cwd);
	}

	toJSON() {
		return { run: this.run, handle: this.handle, topic: this.topic, dir: this.dir, cwd: this.cwd, session: this.session, paneId: this.paneId };
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

async function ensureSession(name: string, cwd: string) {
	const has = await sh("tmux", ["has-session", "-t", name]);
	if (has.exitCode !== 0) {
		const r = await sh("tmux", ["new-session", "-d", "-s", name, "-c", cwd]);
		// Another worker in the same batch may have created it after our check.
		if (r.exitCode !== 0 && (await sh("tmux", ["has-session", "-t", name])).exitCode !== 0)
			throw new Error(`tmux new-session ${name} failed:\n${r.stderr}`);
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
	const cwd = resolve(o.cwd ?? process.cwd());
	const session = o.session ?? slug(o.run);
	await ensureSession(session, cwd);
	await excludeWm(cwd);
	// Own the board window before workmux starts the agent, or a fast report is consumed by a ticking poller against nobody.
	const w = new Worker(o.run, o.handle, cwd, session, resolve(cwd, "..", `${basename(cwd)}__worktrees`, o.handle));
	try {
		const a = o.agent ? agent(o.agent) : undefined;
		let text = o.prompt;
		if (o.from === "summary") {
			const file = o.parentSessionFile ?? process.env.PI_SESSION_FILE;
			if (file && existsSync(file)) text = [parentSummary(file), o.prompt].filter(Boolean).join("\n\n---\n\n");
		} else if (o.from && o.from !== "fork") {
			throw new Error(`from must be "fork" or "summary"`);
		}
		const args = ["add", o.handle, "-b", "--parent-session", session, "-p", prompt({ ...o, prompt: text, agent: a })];
		let cmd = o.command ?? (a ? a.runCommand : o.agent);
		if (o.from === "fork") {
			const source = o.parentSessionFile ?? o.parentSession ?? process.env.PI_SESSION_FILE ?? process.env.PI_SESSION_ID;
			if (!source) throw new Error(`from: "fork" needs parentSessionFile, parentSession, or PI_SESSION_ID`);
			if (!cmd) throw new Error(`from: "fork" needs a pi runCommand`);
			cmd = withFork(cmd, source);
		}
		// Board identity, spawn provenance (session-meta), and the fence ratio ride the agent command's env.
		const env = spawnEnv({ run: o.run, handle: o.handle, agent: a?.name, parentSession: o.parentSession ?? process.env.PI_SESSION_ID, checkpoint: a?.checkpoint });
		if (cmd) args.push("-a", `${env.join(" ")} ${cmd}`);
		if (o.base) args.push("--base", o.base);
		const out = await sh("workmux", args, cwd);
		if (out.exitCode !== 0) throw new Error(`workmux add ${o.handle} failed:\n${out.stderr || out.stdout}`);
		const dir = /Worktree:\s+(\S+)/.exec(out.stdout)?.[1];
		if (dir) w.dir = dir;
		return w;
	} catch (err) {
		w.drop();
		throw err;
	}
}

/** A Worker for a handle spawned elsewhere (another process, or before a resume). Assumes workmux's default worktree layout. */
export function attach(run: string, handle: string, cwd = process.cwd(), session = slug(run)): Worker {
	return new Worker(run, handle, cwd, session, resolve(cwd, "..", `${basename(cwd)}__worktrees`, handle));
}

/** Merge the worker's branch into `into` (default: current branch of cwd) with plain git. */
export async function merge(w: Worker, opts: { into?: string; mode?: "merge" | "rebase" } = {}) {
	const mode = opts.mode ?? "merge";
	const git = (...a: string[]) => sh("git", a, w.cwd);
	if (opts.into) await git("checkout", opts.into);
	if (mode === "rebase") {
		const r = await sh("git", ["rebase", opts.into ?? "HEAD"], w.dir);
		if (r.exitCode !== 0) {
			await sh("git", ["rebase", "--abort"], w.dir);
			throw new MergeConflict(w, await conflictedFiles(w.dir));
		}
		const ff = await git("merge", "--ff-only", w.branch);
		if (ff.exitCode !== 0) throw new Error(`ff-only merge of ${w.branch} failed:\n${ff.stderr}`);
		return;
	}
	const m = await git("merge", "--no-ff", "--no-edit", w.branch);
	if (m.exitCode !== 0) {
		const files = await conflictedFiles(w.cwd);
		await git("merge", "--abort");
		throw new MergeConflict(w, files);
	}
}

async function conflictedFiles(dir: string): Promise<string[]> {
	const out = await sh("git", ["diff", "--name-only", "--diff-filter=U"], dir);
	return out.stdout.split("\n").filter(Boolean);
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
			const w = await spawn({ run: need(opt("run"), "run"), handle: need(pos[0], "handle"), prompt, agent: opt("agent"), base: opt("base"), session: opt("session"), from: opt("from") as "fork" | "summary" | undefined, parentSessionFile: process.env.PI_SESSION_FILE });
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
			await w.observe((await workmuxStatus(w.cwd)).find((e) => e.worktree === w.handle), await livePanes());
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
			print(await workmuxStatus(process.cwd()));
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
			console.error("usage: wm.ts spawn <handle> --run R (--prompt P | --prompt-file F) [--agent A] [--base B] [--from fork|summary]\n       wm.ts next|done|capture|merge|close <handle> --run R\n       wm.ts send <handle> <text> --run R\n       wm.ts status | agents");
			process.exit(2);
	}
}
