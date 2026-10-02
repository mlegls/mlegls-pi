// Frontends call the registry directly; lifecycle and terminal ownership stay in lib/thread.
import { abandonThread, archiveThread, ensureTerminal, forkThread, newThread, type ThreadRecord, type ThreadRow } from "../thread";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { command } from "../thread/process";
import { checkout } from "../thread/git";
import { zmx, zmxBinary } from "../thread/zmx";
import * as ghostty from "./ghostty";

export type Action = "new" | "worktree" | "fork" | "merge" | "archive" | "abandon" | "children";

/** Switch only the main pane belonging to this sidebar, never the most recent client. */
export async function open(id: string, shown?: string): Promise<string> {
	const terminal = await ensureTerminal(id);
	if (shown === terminal.name) return terminal.name;
	if (shown) {
		// zmx 0.8.1 shuts the source down on NoLeaderFound. Never send that switch.
		const leader = await zmx(["print-env", shown]);
		if (!leader.trim()) throw new Error("Main client has no zmx leader; type in it or reattach before switching");
		if (process.env.AB_TREE_TOKEN && !leader.split("\n").includes("AB_TREE_TOKEN=" + process.env.AB_TREE_TOKEN))
			throw new Error("Another window leads this thread; type in this main split before switching");
		const env: NodeJS.ProcessEnv = { ...process.env, ZMX_SESSION: shown };
		delete env.ZMX_SESSION_PREFIX;
		await command(await zmxBinary(), ["attach", terminal.name], undefined, env);
	} else ghostty.attachMain(id);
	return terminal.name;
}

/** A typed project: a path, or anything zoxide knows. */
export function resolveProject(text: string): string | undefined {
	const t = text.trim().replace(/^~(?=\/|$)/, homedir());
	if (!t) return undefined;
	if (existsSync(t)) return realpathSync(resolve(t));
	try { return execFileSync("zoxide", ["query", ...t.split(/\s+/)], { encoding: "utf8" }).trim() || undefined; } catch { return undefined; }
}

/** Make TEXT a project: a bare name lands in ~/dev, a path where it says. Creates the directory,
 * a git repo and an empty first commit as needed (worktrees need a HEAD), and tells zoxide. */
export function initProject(text: string): string {
	const t = text.trim().replace(/^~(?=\/|$)/, homedir());
	if (!t) throw new Error("Name the project");
	const path = resolve(t.includes("/") ? t : homedir() + "/dev/" + t);
	mkdirSync(path, { recursive: true });
	const git = (...args: string[]) => execFileSync("git", ["-C", path, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	try { git("rev-parse", "--show-toplevel"); } catch { git("init", "-q"); }
	try { git("rev-parse", "--verify", "-q", "HEAD"); } catch { git("commit", "-q", "--allow-empty", "-m", "init"); }
	const real = realpathSync(path);
	try { execFileSync("zoxide", ["add", real]); } catch {}
	return real;
}

/** Go to a checkout's oldest interactive thread, or start a guest there without claiming its worktree.
 * fresh always starts another: a main checkout may hold any number of threads, none of them the project. */
export async function openProject(text: string, init = false, fresh = false): Promise<ThreadRecord> {
	const path = init ? initProject(text) : resolveProject(text);
	if (!path) throw new Error("No such project: " + text);
	const { allThreads, isInteractive } = await import("../thread");
	const location = checkout(path);
	const root = location.worktree ?? location.project;
	const live = fresh ? undefined : (await allThreads())
		.filter(t => t.project === location.project && (t.worktree ?? t.project) === root && !t.worker && isInteractive(t))
		.sort((a, b) => a.created.localeCompare(b.created))[0];
	return live ?? newThread({ cwd: root, in: root, interactive: true });
}

export async function create(action: "new" | "worktree" | "fork", selected?: ThreadRecord, name?: string): Promise<ThreadRecord> {
	const options = { cwd: selected?.cwd, parent: selected?.id,
		...(action === "worktree" ? { worktree: name } : { in: selected?.cwd ?? process.cwd() }) };
	if (action === "fork") {
		if (!selected) throw new Error("Select a thread to fork");
		return forkThread(selected.sessionFile, options);
	}
	if (action === "worktree" && !name?.trim()) throw new Error("Supply a worktree branch name");
	return newThread(options);
}

/** Where a sibling worktree branches from: the checkout of the selected thread's merge parent. */
async function siblingBase(selected: ThreadRecord): Promise<string> {
	const { worktrees } = await import("../thread/lifecycle-git");
	const { listThreads } = await import("../thread");
	const row = (await listThreads({ cwd: selected.project })).find(r => r.thread.id === selected.id);
	const parent = row?.mergeParent && (await worktrees(selected.project)).find(t => t.branch === row.mergeParent);
	return parent ? parent.path : selected.project;
}

/** One worktree, one canonical interactive session: every new or forked thread gets its own worktree,
 * a child (merges into the selected thread's branch) or a sibling (merges where the selected one does). */
export async function spawn(kind: "new" | "fork", selected: ThreadRecord | undefined, opts: { sibling?: boolean; name?: string; project?: string; init?: boolean } = {}): Promise<ThreadRecord> {
	const project = opts.project ? (opts.init ? initProject(opts.project) : resolveProject(opts.project)) : undefined;
	if (opts.project && !project) throw new Error("No such project: " + opts.project);
	const cwd = project ?? (selected ? (opts.sibling ? await siblingBase(selected) : selected.cwd) : undefined);
	if (!cwd) throw new Error("Select a thread or a project");
	const name = opts.name?.trim() || "t-" + randomBytes(3).toString("hex");
	const options = { cwd, worktree: name, interactive: true };
	if (kind === "fork") {
		if (!selected) throw new Error("Select a thread to fork");
		return forkThread(selected.sessionFile, options);
	}
	return newThread(options);
}

export async function retire(action: "merge" | "archive" | "abandon" | "children", selected: ThreadRecord, rows: ThreadRow[]): Promise<string[]> {
	const ids = action === "children"
		? rows.filter(r => r.treeParent === selected.id).map(r => r.thread.id) : [selected.id];
	const closed: string[] = [];
	for (const id of ids) {
		const result = action === "abandon" || action === "children" ? await abandonThread(id) : await archiveThread(id);
		closed.push(...result.closed);
		if (result.blocked) throw new Error("Blocked at " + result.blocked.threadId + ": " + result.blocked.block.reason);
	}
	return closed;
}
