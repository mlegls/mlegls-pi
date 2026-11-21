import { lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { bbThreads } from "../thread/bb";
import { checkout } from "../thread/git";
import { worktrees } from "../thread/lifecycle-git";
import { cwdProcesses } from "../thread/resources";
import { git, isAncestor } from "./checks";

/** A saved launch may have died after checkout preparation but before BB registered a worker.
 * Only the reconciler that holds the launch receipt may reclaim that name. */
export async function reclaimSetup(into: string, handle: string, base: string): Promise<string | undefined> {
	const parent = checkout(into);
	const path = resolve(parent.project + "__worktrees", handle);
	const refuse = (reason: string): never => { throw new Error(path + " (branch " + handle + "): " + reason); };
	const entry = (await worktrees(parent.cwd)).find(tree => tree.path === path);
	const directory = lstatSync(path, { throwIfNoEntry: false });
	if (!directory && !entry && !git(parent.cwd, "branch", "--list", handle)) return;
	if (!directory?.isDirectory() || realpathSync(path) !== path || entry?.branch !== handle)
		refuse("expected a linked worktree on the saved launch branch");
	const threads = await bbThreads();
	for (const thread of threads.values()) {
		if (thread.archivedAt || !thread.environmentPath) continue;
		let environment = resolve(thread.environmentPath);
		try { environment = realpathSync(environment); } catch { /* An absent environment still has its recorded path. */ }
		if (environment === path) refuse("BB thread " + thread.id + " still uses this worktree");
	}
	const pids = await cwdProcesses(path);
	if (pids.length) refuse("processes still use this worktree: " + pids.join(", "));
	const worker = checkout(path);
	if (worker.project !== parent.project || worker.worktree !== path || worker.branch !== handle || !parent.branch
		|| git(path, "config", "--local", "--default", "", "--get", "branch." + handle + ".ab-parent") !== parent.branch)
		refuse("worktree does not belong to the expected launching checkout");
	if (git(path, "status", "--porcelain", "--untracked-files=all")) refuse("worktree has uncommitted changes");
	const head = git(path, "rev-parse", "HEAD");
	if (!isAncestor(path, head, base)) refuse("launch base " + base + " does not contain " + head);
	// Setup can leave ignored dependencies and logs. The checks above protect authored work and live users.
	git(parent.cwd, "worktree", "remove", "--force", path);
	git(parent.cwd, "branch", "-D", "--", handle);
	return path;
}
