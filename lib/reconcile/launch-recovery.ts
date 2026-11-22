import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { bbThreads } from "../thread/bb";
import { checkout } from "../thread/git";
import { worktrees } from "../thread/lifecycle-git";
import { cwdProcesses } from "../thread/resources";
import { excludeTracker } from "../thread/tracker-worktree";
import { git, isAncestor } from "./checks";

/** Only a reconciler holding the saved launch receipt may recover an unregistered worktree.
 * Recreate a redundant checkout, but retain the path and branch if it holds work beyond the base. */
export async function reclaimSetup(into: string, handle: string, base: string): Promise<{ path: string; adoptHead?: string } | undefined> {
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
	const parentKey = "branch." + handle + ".ab-parent";
	const recordedParent = git(path, "config", "--local", "--default", "", "--get", parentKey);
	// `worktree add --no-checkout` can finish before the parent is set or the index is populated.
	// This state looks like staged deletions to Git; populate it so ordinary removal can check for edits.
	const unpopulated = !existsSync(git(path, "rev-parse", "--path-format=absolute", "--git-path", "index"))
		&& readdirSync(path).join("\0") === ".git";
	if (worker.project !== parent.project || worker.worktree !== path || worker.branch !== handle || !parent.branch
		|| (recordedParent !== parent.branch && (recordedParent || !unpopulated)))
		refuse("worktree does not belong to the expected launching checkout");
	if (unpopulated) {
		if (!recordedParent) git(path, "config", "--local", parentKey, parent.branch!);
		excludeTracker(path);
	}
	if (git(path, "status", "--porcelain", "--untracked-files=all")) refuse("worktree has uncommitted changes");
	const head = git(path, "rev-parse", "HEAD");
	if (!isAncestor(path, head, base)) return { path, adoptHead: head };
	// Git removes ignored setup output but rechecks for local changes at removal time.
	git(parent.cwd, "worktree", "remove", path);
	git(parent.cwd, "branch", "-D", "--", handle);
	return { path };
}
