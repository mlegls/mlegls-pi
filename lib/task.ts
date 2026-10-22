// Interactive task worktrees (docs/issues/isolate-interactive-edits-in-task-worktrees.md). An interactive bb thread
// edits in its own worktree instead of the shared canonical checkout, commits as it goes and integrates when finished:
//   ab task start <name>      from the canonical checkout: worktree + branch (ab-parent = the checkout's branch), setup
//   ab task join <name>       an existing task's path, for a deliberate collaborator
//   ab task finish [--into B] [--mode rebase|merge]   from the task worktree: serialized integration, then cleanup
// The thread moves with bb's update_environment_directory (effective next turn). Workers are wm's, not this.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkout, git } from "./thread/git";
import { excludeTracker } from "./thread/tracker-worktree";
import { runSetup } from "./thread/setup";
import { integrateCheckout } from "./thread/lifecycle";
import { keepIgnored } from "./thread/lifecycle-cleanup";
import { gitAttempt } from "./thread/lifecycle-git";
import { cwdProcesses } from "./thread/resources";
import { command, delay } from "./thread/process";
import { tellBb } from "./thread/bb";
import { pidAlive } from "./wm";

const bbCli = () => process.env.BB_CLI || "bb";
const config = (cwd: string, key: string) => { try { return git(cwd, "config", "--get", key); } catch { return ""; } };
const common = (cwd: string) => git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir");

/** The task a checkout is: a linked worktree whose branch `ab task start` made. */
export function taskOf(cwd: string): { name: string; path: string; branch: string; parent: string; project: string } | undefined {
	let c;
	try { c = checkout(cwd); } catch { return; }
	if (!c.worktree || !c.branch || config(c.project, "branch." + c.branch + ".ab-task") !== "true") return;
	return { name: c.branch, path: c.worktree, branch: c.branch, parent: config(c.project, "branch." + c.branch + ".ab-parent"), project: c.project };
}

export const taskPath = (project: string, name: string) => resolve(project + "__worktrees", name);

/** A worktree for an interactive task, from the main checkout's branch, set up as worker worktrees are. */
export async function startTask(cwd: string, name: string): Promise<{ path: string; branch: string; parent: string; setup: string }> {
	const c = checkout(cwd);
	const parent = git(c.project, "branch", "--show-current");
	if (!parent) throw new Error("the main checkout " + c.project + " is not on a branch");
	git(c.project, "check-ref-format", "--branch", name);
	const path = taskPath(c.project, name);
	if (existsSync(path)) throw new Error("already exists: " + path + (config(c.project, "branch." + name + ".ab-task") === "true" ? " (a task: ab task join " + name + ")" : ""));
	if (git(c.project, "branch", "--list", name)) throw new Error("branch " + name + " already exists; pick another name");
	git(c.project, "worktree", "add", "--no-checkout", "-b", name, path, parent);
	try {
		// The tracker stays global: no docs/issues/ in the task, as in worker worktrees.
		excludeTracker(path);
		git(c.project, "config", "branch." + name + ".ab-parent", parent);
		git(c.project, "config", "branch." + name + ".ab-task", "true");
		await runSetup({ cwd: path, project: c.project, worktree: path, branch: name, worker: { run: "task", handle: name } });
	} catch (error) {
		try { git(c.project, "worktree", "remove", "--force", path); git(c.project, "branch", "-D", name); } catch {}
		throw error;
	}
	return { path, branch: name, parent, setup: existsSync(join(path, ".wm", "setup.log")) ? join(path, ".wm", "setup.log") : "none declared" };
}

/** Integrations into one repository's checkouts run one at a time: a second finish waits, then rebases onto the first. */
async function integrationLock<T>(cwd: string, work: () => Promise<T>): Promise<T> {
	const lock = join(common(cwd), "ab-integrate.lock");
	for (const deadline = Date.now() + 10 * 60_000; ;) {
		try { mkdirSync(lock); writeFileSync(join(lock, "pid"), String(process.pid)); break; }
		catch (error) {
			if ((error as { code?: string }).code !== "EEXIST") throw error;
			let pid = 0; try { pid = Number(readFileSync(join(lock, "pid"), "utf8")); } catch {}
			if (pid && !pidAlive(pid)) { rmSync(lock, { recursive: true, force: true }); continue; }
			if (Date.now() > deadline) throw new Error("integration lock held by pid " + pid + ": " + lock);
			await delay(500);
		}
	}
	try { return await work(); } finally { rmSync(lock, { recursive: true, force: true }); }
}

/** Integrate this task (or a bb-managed worktree, given into) into its recorded target, then hand cleanup to a reaper
 * that removes an ab-task worktree once nothing runs in it any more. */
export async function finishTask(cwd: string, o: { into?: string; mode?: "rebase" | "merge"; reap?: boolean } = {}) {
	const c = checkout(cwd);
	if (!c.worktree || !c.branch) throw new Error("finish runs in a task's worktree (a linked worktree on a branch), not " + c.cwd);
	const key = "branch." + c.branch + ".ab-parent";
	const recorded = config(c.project, key);
	if (o.into && recorded && recorded !== o.into) throw new Error(c.branch + " already targets " + recorded + ", not " + o.into);
	if (!recorded && !o.into) throw new Error(c.branch + " records no target: pass --into <branch>");
	if (!recorded) git(c.project, "config", key, o.into!);
	const result = await integrationLock(c.project, () => integrateCheckout({ cwd: c.worktree!, project: c.project, branch: c.branch! }, c.branch!, { mode: o.mode }));
	const task = config(c.project, "branch." + c.branch + ".ab-task") === "true";
	let reaper: number | undefined;
	if (task && o.reap !== false) {
		const dir = join(common(c.project), "ab-task");
		mkdirSync(dir, { recursive: true });
		const fd = openSync(join(dir, c.branch.replace(/\//g, "-") + ".log"), "a");
		const child = Bun.spawn(["bun", import.meta.path, "reap", c.worktree], { cwd: c.project, stdio: ["ignore", fd, fd], env: { ...process.env, PI_SESSION_ID: "" } });
		child.unref(); closeSync(fd);
		reaper = child.pid;
	}
	return { ...result, cleanup: task ? (reaper ? "reaper pid " + reaper + " removes " + c.worktree + " once no process runs in it" : "skipped") : "bb retires its own worktree when the thread is archived" };
}

/** Once no process runs inside a finished task's worktree: keep ignored state setup can't regenerate, remove it, delete
 * the branch if its work is in the target, and delete bb's environment for the path. Leaves anything uncommitted alone. */
export async function reapTask(path: string, o: { wait?: number; poll?: number } = {}) {
	path = resolve(path);
	const c = checkout(path);
	const branch = c.branch!, project = c.project;
	path = c.worktree ?? path;
	const parent = config(project, "branch." + branch + ".ab-parent");
	const until = Date.now() + (o.wait ?? 6 * 3600_000);
	for (;;) {
		const pids = (await cwdProcesses(path)).filter(p => p !== process.pid);
		if (!pids.length) break;
		if (Date.now() > until) return { removed: false, reason: "processes still running inside: " + pids.join(", ") };
		await delay(o.poll ?? 5_000);
	}
	if (git(path, "status", "--porcelain")) return { removed: false, reason: "uncommitted changes appeared after finish; left in place" };
	const kept = await keepIgnored(path, { id: "", cwd: path, project, worktree: path, branch, worker: { run: "task", handle: branch } }, undefined);
	git(project, "worktree", "remove", "--force", path);
	const merged = !!parent && (await gitAttempt(project, "merge-base", "--is-ancestor", branch, parent)).code === 0;
	if (merged) { git(project, "branch", "-D", branch); for (const k of ["ab-parent", "ab-task"]) await gitAttempt(project, "config", "--unset", "branch." + branch + "." + k); }
	let environment = "none";
	try {
		const rows = JSON.parse(await command(bbCli(), ["environment", "list", "--json"])) as { id: string; path: string | null }[];
		const env = rows.find(r => r.path && resolve(r.path) === path);
		if (env) { await command(bbCli(), ["environment", "delete", env.id, "--json"]); environment = env.id; }
	} catch (error) { environment = "not deleted: " + String(error).split("\n")[0]; }
	return { removed: true, branch: merged ? "deleted" : "kept (not in " + parent + ")", kept: kept?.path ?? null, environment };
}

const USAGE = "usage: ab task start <name> | join <name> | finish [--into <branch>] [--mode rebase|merge] | status";

export async function main(argv: string[]) {
	const [cmd, ...rest] = argv;
	const flag = (name: string) => { const i = rest.indexOf("--" + name); return i >= 0 ? rest.splice(i, 2)[1] : undefined; };
	const cwd = process.cwd();
	if (cmd === "start" && rest[0]) {
		const t = await startTask(cwd, rest[0]);
		// Queued behind this turn: the next turn starts in the worktree without the user having to ask.
		const thread = process.env.BB_THREAD_ID;
		if (thread) await tellBb(thread, "[task] Continue the task in its worktree " + t.path + " (branch " + t.branch + ", target " + t.parent + "). Commit coherent changes as you go; finish with ab task finish.");
		console.log([
			"task worktree: " + t.path, "branch: " + t.branch + " (target " + t.parent + ")", "setup: " + t.setup,
			"Now call update_environment_directory with " + t.path + " and end your turn" + (thread ? "; a queued message resumes you there." : "."),
			"Nothing uncommitted moves with you: redo or carry over only your own changes.",
		].join("\n"));
	} else if (cmd === "join" && rest[0]) {
		const c = checkout(cwd), path = taskPath(c.project, rest[0]);
		if (!existsSync(path) || config(c.project, "branch." + rest[0] + ".ab-task") !== "true") throw new Error("no task " + rest[0] + " at " + path);
		console.log(path + "\nJoining shares its files and index with the task's owner: call update_environment_directory with this path only for deliberate collaboration.");
	} else if (cmd === "finish") {
		const into = flag("into"), mode = flag("mode") as "rebase" | "merge" | undefined;
		const r = await finishTask(cwd, { into, mode });
		console.log(JSON.stringify(r, null, 1));
		console.log("Integrated " + r.branch + " into " + r.parentBranch + " at " + r.path + "." + (r.cleanup.startsWith("reaper") ? " Move back with update_environment_directory " + r.path + " and end your turn; the worktree is removed once this thread's pi has left it (its next turn)." : ""));
	} else if (cmd === "status") {
		console.log(JSON.stringify(taskOf(cwd) ?? null, null, 1));
	} else if (cmd === "reap" && rest[0]) {
		console.log(new Date().toISOString() + " " + JSON.stringify(await reapTask(rest[0])));
	} else throw new Error(USAGE);
}

if (import.meta.main) main(process.argv.slice(2)).catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
