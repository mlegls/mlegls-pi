import { gitAttempt, gitChecked, worktrees } from "./lifecycle-git";
import { retireThread } from "./lifecycle-cleanup";
import { assertNoTrackerChanges } from "./tracker-worktree";
import { workerOf } from "./runtime";
import type { ThreadCleanup, ThreadIntegration } from "./types";

export class ThreadMergeConflict extends Error {
	constructor(readonly threadId: string, readonly branch: string, readonly parentBranch: string, readonly files: string[]) {
		super("conflicts merging " + branch + " into " + parentBranch + ": " + files.join(", "));
		this.name = "ThreadMergeConflict";
	}
}

async function clean(cwd: string, when: string): Promise<void> {
	const dirty = await gitChecked(cwd, "status", "--porcelain");
	if (dirty) throw new Error("integrate: " + when + "uncommitted changes in " + cwd + "\n" + dirty);
}

/** After a landing moved `path` from `base` to HEAD: reset index entries that still hold `base`'s version of a path
 * the landing changed, so the index matches HEAD there. Any other staged entry is someone's intent and stays.
 * Returns the paths reset. */
export async function alignIndex(path: string, base: string): Promise<string[]> {
	const split = (s: string) => s.split("\0").filter(Boolean);
	const staged = split(await gitChecked(path, "diff", "--cached", "--name-only", "--no-renames", "-z", "HEAD"));
	if (!staged.length) return [];
	const landed = new Set(split(await gitChecked(path, "diff", "--name-only", "--no-renames", "-z", base, "HEAD")));
	const candidates = staged.filter(p => landed.has(p));
	if (!candidates.length) return [];
	const entries = (listing: string, at: (fields: string[]) => string) => new Map(split(listing).map(row => {
		const tab = row.indexOf("\t");
		return [row.slice(tab + 1), at(row.slice(0, tab).split(" "))] as const;
	}));
	// ls-files -s: "<mode> <oid> <stage>\t<path>"; ls-tree: "<mode> <type> <oid>\t<path>".
	const index = entries(await gitChecked(path, "ls-files", "-s", "-z", "--", ...candidates), ([mode, oid]) => mode + " " + oid);
	const before = entries(await gitChecked(path, "ls-tree", "-z", base, "--", ...candidates), ([mode, , oid]) => mode + " " + oid);
	const stale = candidates.filter(p => index.get(p) === before.get(p));
	if (stale.length) await gitChecked(path, "reset", "-q", "HEAD", "--", ...stale);
	return stale;
}

/** One worker thread's (bb thread id) git integration into the branch's ab-parent; no cleanup or conflict messaging. */
export async function integrateThread(id: string, options: {
	mode?: "rebase" | "merge";
	prepare?: () => Promise<void>;
} = {}): Promise<ThreadIntegration> {
	const thread = await workerOf(id);
	if (!thread) throw new Error("No active worker thread: " + id);
	return integrateCheckout(thread, id, options);
}

/** A linked worktree's branch into its recorded ab-parent's checkout: rebase onto that HEAD and fast-forward (or merge),
 * align the destination's index and run its post-merge hook. Shared by worker integration and interactive tasks
 * (lib/task.ts); `label` names the source in a conflict. */
export async function integrateCheckout(thread: { cwd: string; project: string; branch: string }, label: string, options: {
	mode?: "rebase" | "merge";
	prepare?: () => Promise<void>;
} = {}): Promise<ThreadIntegration> {
	const id = label;
	const branch = thread.branch;
	if (await gitChecked(thread.cwd, "branch", "--show-current") !== branch)
		throw new Error("integrate: thread branch is not checked out in " + thread.cwd);
	await clean(thread.cwd, "");
	const config = await gitAttempt(thread.project, "config", "--get", "branch." + branch + ".ab-parent");
	if (config.code !== 0 && config.code !== 1) throw new Error("integrate: cannot read ab-parent: " + config.err);
	const parentBranch = config.out;
	if (!parentBranch) throw new Error("integrate: missing ab-parent for " + branch);
	if (parentBranch === branch) throw new Error("integrate: " + branch + " cannot merge into itself");
	await gitChecked(thread.project, "show-ref", "--verify", "refs/heads/" + parentBranch);
	const destination = (await worktrees(thread.project)).find(t => t.branch === parentBranch);
	if (!destination) throw new Error("integrate: ab-parent " + parentBranch + " has no checkout");
	const path = destination.path;
	if (await gitChecked(path, "branch", "--show-current") !== parentBranch)
		throw new Error("integrate: ab-parent " + parentBranch + " is no longer checked out in " + path);
	const base = await gitChecked(path, "rev-parse", "HEAD");
	assertNoTrackerChanges(thread.cwd, base);
	const mode = options.mode ?? "rebase";
	const diff3 = ["-c", "merge.conflictStyle=diff3"];
	// Ordinary code conflicts capture their files before aborting.
	const conflict = async (cwd: string, operation: "merge" | "rebase") => {
		// Capture before abort removes the unmerged index.
		const files = (await gitChecked(cwd, "diff", "--name-only", "--diff-filter=U", "-z")).split("\0").filter(Boolean);
		await gitChecked(cwd, operation, "--abort");
		throw new ThreadMergeConflict(id, branch, parentBranch, files);
	};
	if (mode === "rebase") {
		const contains = await gitAttempt(thread.cwd, "merge-base", "--is-ancestor", base, "HEAD");
		if (contains.code > 1) throw new Error("integrate: cannot check ancestry: " + contains.err);
		if (contains.code) {
			// Keep conflict resolutions in a merge-bearing child rather than replaying through them.
			const merged = await gitChecked(thread.cwd, "rev-list", "--merges", "--count", base + "..HEAD") !== "0";
			const update = merged
				? await gitAttempt(thread.cwd, ...diff3, "merge", "--no-edit", "--no-verify", base)
				: await gitAttempt(thread.cwd, ...diff3, "rebase", base);
			if (update.code) await conflict(thread.cwd, merged ? "merge" : "rebase");
		}
	}
	await options.prepare?.();
	assertNoTrackerChanges(thread.cwd, base);
	await clean(thread.cwd, "preparation left ");
	// The destination may be dirty (a thread working in place there): git itself refuses only when the merge would overwrite those files.
	const printed: string[] = [];
	if (mode === "merge") {
		const merged = await gitAttempt(path, ...diff3, "merge", "--no-ff", "--no-edit", branch);
		if (merged.code) await conflict(path, "merge");
		printed.push(merged.out, merged.err);
		const aligned = await alignIndex(path, base);
		if (aligned.length) printed.push("integrate: reset the index to HEAD for " + aligned.join(", "));
	} else {
		// post-merge runs once the index is known to match HEAD for what landed: concept's refuses an index that doesn't
		// (2026-10-17, after 2eb22adf and da7a071a landed, the index held their pre-landing entries).
		const ff = await gitAttempt(path, "-c", "core.hooksPath=/dev/null", "merge", "--ff-only", branch);
		if (ff.code) throw new Error("integrate: ff-only merge of " + branch + " into " + parentBranch + " failed: " + ff.err);
		printed.push(ff.out, ff.err);
		const aligned = await alignIndex(path, base);
		if (aligned.length) printed.push("integrate: reset the index to HEAD for " + aligned.join(", "));
		const hook = await gitAttempt(path, "hook", "run", "--ignore-missing", "post-merge", "--", "0");
		printed.push(hook.out, hook.err);
		if (hook.code) printed.push("integrate: post-merge hook exited " + hook.code);
	}
	return { branch, parentBranch, path, mode, output: printed.filter(Boolean).join("\n") };
}

/** Retire a worker: stop its pi and processes, remove its worktree and branch, archive its bb thread and delete its
 * environment. Nothing is merged. keepBranch preserves the branch. Ignored state setup can't regenerate is moved aside
 * (ThreadCleanup.kept) unless discardIgnored says the work was taken. Nothing to do once the thread is archived. */
export async function abandonThread(id: string, options: { keepBranch?: boolean; discardIgnored?: boolean } = {}): Promise<ThreadCleanup> {
	const thread = await workerOf(id);
	if (!thread) return { closed: [], killed: [], branchesDeleted: [], branchesKept: [] };
	return retireThread(thread, options.keepBranch ?? false, { discardIgnored: options.discardIgnored ?? false });
}
