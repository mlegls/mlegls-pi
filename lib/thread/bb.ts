// bb (get-bb/bb) as the thread runtime: bb runs pi (its Pi provider) and shows the thread in its desktop, web and mobile
// apps. The worktree, setup and integration stay ours.
// bb gives every thread the same environment, so a worker's identity reaches pi through .wm/launch.env in its
// worktree, which bin/bb-pi (bb's BB_PI_BRIDGE_COMMAND) sources before exec'ing pi.
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { command, delay, quote } from "./process";
import { launchEnv } from "./launch";
import { gitAttempt } from "./lifecycle-git";
import type { WorkerCheckout } from "./types";

const cli = () => process.env.BB_CLI || "bb";
async function bb<T = unknown>(args: string[], cwd?: string): Promise<T> {
	const out = await command(cli(), [...args, "--json"], cwd);
	const value = JSON.parse(out);
	if (value && typeof value === "object" && value.ok === false) throw new Error("bb " + args.join(" ") + ": " + (value.error?.message ?? out));
	return value as T;
}

/** Fail before any worktree exists when no bb daemon answers: the CLI reaches it from a bb thread or a plain terminal alike. */
export async function assertBb(): Promise<void> {
	try { await bb(["project", "list"]); }
	catch (error) { throw new Error("bb is not running: start the bb app (threads and workers run as bb threads). " + String(error).split("\n")[0]); }
}

interface BbProject { id: string; sources: { path: string }[] }
const projects = new Map<string, string>();
/** The bb project whose source is this main checkout, created on first use. */
export async function bbProject(main: string): Promise<string> {
	const hit = projects.get(main);
	if (hit) return hit;
	const all = await bb<BbProject[]>(["project", "list"]);
	let id = all.find(p => p.sources?.some(s => s.path === main))?.id;
	id ??= (await bb<BbProject>(["project", "create", "--root", main, "--name", main.split("/").at(-1)!])).id;
	projects.set(main, id);
	return id;
}

export interface BbThread {
	id: string; status: "pending" | "idle" | "starting" | "active" | "stopping" | "error"; archivedAt: number | null; parentThreadId: string | null;
	/** A worker's is `<run>/<handle>` (spawnBb). */
	title?: string | null;
	/** The thread's environment checkout. */
	environmentPath?: string | null;
	createdAt?: number;
}
/** Unarchived bb threads by id, across projects; hidden ones included. */
export async function bbThreads(): Promise<Map<string, BbThread>> {
	return new Map((await bb<BbThread[]>(["thread", "list", "--include-hidden"])).map(t => [t.id, t]));
}

/** Whether bb is running a turn for the thread: an idle or errored thread is not, and bb may release an idle thread's pi without ending it. */
export const bbWorking = (t: BbThread | undefined): boolean => !!t && !t.archivedAt && t.status !== "idle" && t.status !== "error";

/** The live bb thread titled `<run>/<handle>`, or for a bare handle the one in any run. Dispatch recovers a worker spawned
 * just before a crash from this when run state has no receipt for it. `within` narrows to one repository by environment path. */
export function bbWorkerThread(threads: Map<string, BbThread>, handle: string, run?: string, within?: (path: string) => boolean): BbThread | undefined {
	const matches = [...threads.values()].filter(t => !t.archivedAt && t.environmentPath && (run === undefined ? t.title?.endsWith("/" + handle) : t.title === run + "/" + handle)
		&& (!within || within(t.environmentPath)));
	if (matches.length > 1) throw new Error("Ambiguous worker " + handle + (run === undefined ? "; supply its run" : " in run " + run) + ": " + matches.map(t => t.id).join(", "));
	return matches[0];
}

// A bb thread gets its identity and, when the spawner set them, the
// state locations that isolate a fixture (agent and roster dirs).
const IDENTITY = /^(?:PI_WM_.*|PI_CHECKPOINT|PI_CODING_AGENT_DIR|PI_AGENTS_DIR|XDG_STATE_HOME|TRACKER_CLI)$/;
/** The worker's identity env, for bin/bb-pi to source. */
export function writeLaunchEnv(thread: WorkerCheckout): void {
	const env = launchEnv(thread);
	const keys = new Set([...Object.keys(env).filter(k => IDENTITY.test(k)), ...Object.keys(thread.launch?.env ?? {})]);
	mkdirSync(join(thread.cwd, ".wm"), { recursive: true });
	writeFileSync(join(thread.cwd, ".wm", "launch.env"), [...keys].filter(k => env[k] !== undefined).map(k => k + "=" + quote(env[k]!)).join("\n") + "\n");
}

/** pi's --model and --thinking from the launch args; bb passes them as its model and reasoning level. */
function modelOf(thread: WorkerCheckout): { model?: string; effort?: string } {
	const args = thread.launch?.args ?? [];
	const at = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
	return { model: at("--model"), effort: at("--thinking") };
}

/** Start the thread's pi in bb under parent (a bb thread id), submitting its launch prompt. */
export async function spawnBb(thread: WorkerCheckout, parent: string | undefined, o: { model?: string; effort?: string; prompt?: string } = {}): Promise<string> {
	writeLaunchEnv(thread);
	const { model, effort } = o.model ? o : modelOf(thread);
	const dir = mkdtempSync(join(tmpdir(), "bb-prompt-"));
	const prompt = join(dir, "prompt.md");
	writeFileSync(prompt, o.prompt ?? (thread.launch?.prompt?.trim() || "Continue."), { mode: 0o600 });
	try {
		const title = thread.worker.run + "/" + thread.worker.handle;
		const created = await bb<{ id: string; environmentId: string | null }>(["thread", "spawn", "--project", await bbProject(thread.project), "--environment", thread.cwd,
			"--provider", "pi", ...(model ? ["--model", model] : []), ...(effort ? ["--reasoning-level", effort] : []),
			"--title", title, "--prompt-file", prompt, ...(parent ? ["--parent-thread", parent] : [])]);
		try {
			const parentBranch = await gitAttempt(thread.project, "config", "--get", "branch." + thread.branch + ".ab-parent");
			if (parentBranch.code !== 0 && parentBranch.code !== 1) throw new Error("Cannot read ab-parent: " + parentBranch.err);
			if (parentBranch.out) await bb(["environment", "update", await bbEnvironment(created.id, created.environmentId), "--merge-base-branch", parentBranch.out]);
		} catch (error) {
			await stopBb(created.id);
			await archiveBb(created.id);
			await deleteBbEnvironment(created.id);
			throw error;
		}
		return created.id;
	} finally { rmSync(dir, { recursive: true, force: true }); }
}

/** A fresh path's environment is created just after spawn returns, so spawn's environmentId is null until then. */
async function bbEnvironment(id: string, known: string | null): Promise<string> {
	for (let i = 0; !known && i < 100; i++) {
		if (i) await delay(100);
		known = (await bb<{ thread: { environmentId: string | null } }>(["thread", "show", id])).thread.environmentId;
	}
	if (!known) throw new Error("bb thread " + id + " has no environment");
	return known;
}

/** The pi session bb keeps for a thread: ~/.bb/pi-bridge-sessions/<providerThreadId>.jsonl. */
export async function bbSessionFile(id: string): Promise<string> {
	const events = JSON.parse(await command(cli(), ["thread", "log", id, "--json", "--all"])) as { data?: { providerThreadId?: string } }[];
	const provider = events.map(e => e.data?.providerThreadId).filter(Boolean).at(-1);
	if (!provider) throw new Error("bb thread " + id + " has no pi session yet");
	return providerFile(provider);
}
export const bbSessionDir = () => process.env.BB_PI_BRIDGE_SESSION_DIR || join(homedir(), ".bb", "pi-bridge-sessions");
const providerFile = (provider: string) => join(bbSessionDir(), provider.replace(/[^A-Za-z0-9._-]/g, "_") + ".jsonl");

/** Read bb's database directly (read-only): a few queries the CLI has no cheap answer for. undefined without bb. */
function bbDb<T>(f: (db: Database) => T): T | undefined {
	const file = join(process.env.BB_HOME || join(homedir(), ".bb"), "bb.db");
	if (!existsSync(file)) return undefined;
	let db: Database;
	try { db = new Database(file, { readonly: true }); } catch { return undefined; }
	try { return f(db); } catch { return undefined; } finally { db.close(); }
}

/** One pi session bb ran for a thread; a rewind starts a new one, so a thread can have several (latest: newest `at`). */
export interface BbSession { thread: string; parent?: string; title?: string; provider: string; file: string; at: number }
/** Every pi session bb has run, from its thread/identity events. */
export function bbSessions(): BbSession[] {
	return bbDb(db => db.query(`select e.thread_id thread, e.provider_thread_id provider, t.parent_thread_id parent, coalesce(t.title, t.title_fallback) title, max(e.created_at) at
		from events e join threads t on t.id = e.thread_id
		where e.type = 'thread/identity' and e.provider_thread_id is not null and t.deleted_at is null
		group by e.thread_id, e.provider_thread_id`).all() as any[])
		?.map(r => ({ thread: r.thread, parent: r.parent ?? undefined, title: r.title ?? undefined, provider: r.provider, file: providerFile(r.provider), at: r.at })) ?? [];
}

/** What the maintainer typed into bb threads (bb's prompt history), with the thread's project checkout. */
export function bbPrompts(): { thread: string; project: string; at: number; text: string }[] {
	return bbDb(db => db.query(`select p.thread_id thread, coalesce(s.path, pr.name) project, p.created_at at, p.input input
		from prompt_history_entries p join projects pr on pr.id = p.project_id
		left join project_sources s on s.project_id = p.project_id and s.is_default = 1`).all() as any[])
		?.map(r => {
			let text = String(r.input);
			try { const parts = JSON.parse(text); if (Array.isArray(parts)) text = parts.filter((c: any) => c?.type === "text").map((c: any) => c.text).join("\n"); } catch {}
			return { thread: r.thread, project: r.project, at: r.at, text };
		}) ?? [];
}
/** Message a bb thread. Queued, it follows the turn in progress (or starts one) rather than steering it; the text goes by file so a leading dash or backtick survives. */
export async function tellBb(id: string, text: string, mode: "queue" | "steer" = "queue"): Promise<void> {
	const dir = mkdtempSync(join(tmpdir(), "bb-tell-"));
	const file = join(dir, "message.md");
	writeFileSync(file, text, { mode: 0o600 });
	try { await bb(["thread", "tell", id, "--mode", mode, "--message-file", file]); }
	finally { rmSync(dir, { recursive: true, force: true }); }
}
interface BbQueued { id: string; state: string; editable: boolean; sendAt: number | null; content: { type: string; text?: string }[] }
/** Queue text for a bb thread, appending it to a message still waiting there that starts with `prefix` (text should too):
 * each queued row is its own turn, so notices sent while the thread is busy then arrive as one. A row bb has already
 * claimed can't be edited; that, or no such row, sends the text as a new message. */
export async function tellBbFolded(id: string, prefix: string, text: string): Promise<void> {
	const rows = await bb<BbQueued[]>(["thread", "queue", "list", id]).catch(() => []);
	const body = (r: BbQueued) => r.content.filter(c => c.type === "text").map(c => c.text ?? "").join("\n");
	const row = rows.findLast(r => (r.state === "queued" || r.state === "waiting") && r.editable && r.sendAt == null && body(r).startsWith(prefix));
	if (row) {
		const dir = mkdtempSync(join(tmpdir(), "bb-tell-"));
		const file = join(dir, "message.md");
		writeFileSync(file, body(row) + "\n\n" + text, { mode: 0o600 });
		try { await bb(["thread", "queue", "update", id, row.id, "--message-file", file]); return; }
		catch {}
		finally { rmSync(dir, { recursive: true, force: true }); }
	}
	await tellBb(id, text);
}
/** Stop the turn and release bb's pi; the thread stays for a later message. */
// A thread deleted in bb (or with its project) has nothing left to stop or archive.
const gone = (error: unknown) => /not found|404/i.test(String(error));
export const stopBb = (id: string) => bb(["thread", "stop", id]).catch(error => { if (!gone(error) && !/not (?:running|active)|idle/i.test(String(error))) throw error; });
export const archiveBb = (id: string) => bb(["thread", "archive", id]).catch(error => { if (!gone(error)) throw error; });
/** The worktree is already gone and its thread archived; keep thread history, retire only its environment. */
export async function deleteBbEnvironment(id: string): Promise<void> {
	try {
		const { thread } = await bb<{ thread: { environmentId: string | null } }>(["thread", "show", id]);
		if (thread.environmentId) await bb(["environment", "delete", thread.environmentId]);
	} catch (error) { if (!gone(error)) throw error; }
}
export const logBb = (id: string) => command(cli(), ["thread", "log", id, "--all"]);
