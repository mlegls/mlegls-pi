import { realpathSync } from "node:fs";
import { allThreads, getThread, saveThread } from "../../lib/thread/registry";
import { checkout, git } from "../../lib/thread/git";
import type { ThreadRecord } from "../../lib/thread/types";

const inside = (path: string, root: string) => path === root || path.startsWith(root + "/");

function abParent(project: string, branch?: string): string | undefined {
	if (!branch) return;
	try { return git(project, "config", "--get", "branch." + branch + ".ab-parent") || undefined; }
	catch { return; }
}

/** The owned worktree a move to target would leave behind, if any. */
function leftBehind(thread: ThreadRecord, target: string): string | undefined {
	if (thread.ownership !== "owner" || !thread.worktree) return;
	const root = realpathSync(thread.worktree);
	return inside(target, root) ? undefined : root;
}

/** Why this thread cannot move to target: the worktree it owns and would leave holds unmerged work. */
export function moveRefusal(thread: ThreadRecord, target: string): string | undefined {
	const root = leftBehind(thread, target);
	if (!root) return;
	const reasons: string[] = [];
	const dirty = git(root, "status", "--porcelain");
	if (dirty) reasons.push("uncommitted changes:\n" + dirty);
	const parent = abParent(thread.project, thread.branch);
	if (!parent) reasons.push("its branch records no merge parent, so whether it is merged is unknown");
	else {
		const ahead = git(root, "rev-list", "--count", parent + "..HEAD");
		if (ahead !== "0") reasons.push(ahead + " commit(s) on " + thread.branch + " not in " + parent);
	}
	if (!reasons.length) return;
	return "This thread owns the worktree " + root + " (branch " + thread.branch + "), which it would leave with unmerged work: " + reasons.join("; ") +
		"\nLand or discard that work first" + (parent ? " (commit, then merge " + thread.branch + " into " + parent + ")" : "") +
		", then request the switch again; the worktree is closed as part of the switch. If work should go on in both places, ask the user to fork a thread instead.";
}

/** Point the thread at target and its new session, then close the worktree it owned and left (moveRefusal passed).
 * Returns what happened to that worktree, if anything. */
export async function moveThread(id: string, target: string, session: { id: string; file: string }): Promise<string | undefined> {
	const thread = await getThread(id);
	if (!thread) throw new Error("Thread disappeared during workspace switch: " + id);
	const root = leftBehind(thread, target);
	let location: Pick<ThreadRecord, "cwd" | "project" | "worktree" | "branch">;
	try { location = checkout(target); }
	catch { location = { cwd: target, project: target, worktree: undefined, branch: undefined }; }
	const stays = thread.ownership === "owner" && !root;
	await saveThread({
		...thread, sessionId: session.id, sessionFile: session.file, ...location,
		ownership: stays ? "owner" : "guest", ...(stays ? { worktree: thread.worktree, branch: thread.branch } : {}),
	});
	if (!root) return;
	// Removing it would pull the checkout from under another thread, or the merge target from its children.
	const dependents = (await allThreads()).filter(t => t.id !== thread.id &&
		(inside(t.cwd, root) || (t.project === thread.project && abParent(t.project, t.branch) === thread.branch)));
	if (dependents.length) return "kept " + root + ": threads " + dependents.map(t => t.id).join(", ") + " work in it or merge into it";
	git(thread.project, "worktree", "remove", root);
	if (thread.branch) git(thread.project, "branch", "-D", thread.branch);
	return "closed this thread's merged worktree " + root;
}
