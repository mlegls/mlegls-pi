import { tellBb } from "./bb";
import { lastTurn } from "./turn";
import { parse } from "../report";
import { allThreads, getThread, saveThread } from "./registry";
import { gitAttempt, gitChecked, worktrees } from "./lifecycle-git";
import { retireThread } from "./lifecycle-cleanup";
import { assertNoTrackerChanges } from "./tracker-worktree";
import { delay } from "./process";
import type { ThreadBlock, ThreadCleanup, ThreadIntegration, ThreadRecord } from "./types";

export class ThreadMergeConflict extends Error {
	constructor(readonly threadId: string, readonly branch: string, readonly parentBranch: string, readonly files: string[]) {
		super("conflicts merging " + branch + " into " + parentBranch + ": " + files.join(", "));
		this.name = "ThreadMergeConflict";
	}
}

async function threadRecord(id: string): Promise<ThreadRecord> {
	const thread = await getThread(id);
	if (!thread) throw new Error("Unknown thread: " + id);
	return thread;
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

/** One thread's git integration into ab-parent; no cleanup or automatic conflict messaging. Guest returns undefined. */
export async function integrateThread(id: string, options: {
	mode?: "rebase" | "merge";
	prepare?: (thread: ThreadRecord) => Promise<void>;
} = {}): Promise<ThreadIntegration | undefined> {
	const thread = await threadRecord(id);
	if (thread.ownership === "guest") return;
	if (thread.archived) throw new Error("No active thread: " + id);
	const branch = thread.branch;
	if (!branch || await gitChecked(thread.cwd, "branch", "--show-current") !== branch)
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
	await options.prepare?.(thread);
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

async function blockThread(id: string, block: ThreadBlock): Promise<void> {
	await saveThread({ ...await threadRecord(id), blocked: block });
}

async function resolveConflict(error: ThreadMergeConflict): Promise<ThreadBlock | undefined> {
	const id = error.threadId;
	let block: ThreadBlock = { action: "archive", parentBranch: error.parentBranch, files: error.files, reason: error.message };
	await blockThread(id, block);
	const thread = await threadRecord(id);
	if (!thread.bb) return blockThread(id, block = { ...block, reason: "Archive conflict unresolved: thread " + id + " has no bb thread to ask" }).then(() => block);
	// The cursor precedes the request, not the first poll: a quick response must not be missed.
	let cursor = (await lastTurn(thread.bb))?.seq ?? 0;
	await tellBb(thread.bb, "Archive conflict: rebase onto " + error.parentBranch + " and resolve.\nFiles: " +
		error.files.join(", ") + "\nCommit the resolution; do not retire or archive any thread. Report done when resolved, or blocked if you cannot proceed.");
	while (true) {
		const current = await threadRecord(id);
		if (current.archived) return;
		const turn = await lastTurn(thread.bb, cursor);
		if (turn) {
			cursor = turn.seq;
			const report = parse(turn.body);
			if (report.status === "done") {
				await saveThread({ ...await threadRecord(id), blocked: undefined });
				return;
			}
			block = { ...block, reason: "Archive conflict unresolved: agent reported " + (report.status ?? "no status") + "\n" + turn.body };
			await blockThread(id, block);
			return block;
		}
		await delay(500);
	}
}

async function cleanupTree(id: string, archive: boolean, keepBranch: boolean, discardIgnored: boolean): Promise<ThreadCleanup> {
	const root = await threadRecord(id);
	const result: ThreadCleanup = { closed: [], killed: [], branchesDeleted: [], branchesKept: [] };
	if (root.archived) return result;
	const records = await allThreads();
	const order: string[] = [], visiting = new Set<string>(), visited = new Set<string>();
	const visit = (node: string) => {
		if (visiting.has(node)) throw new Error("Cycle in thread spawn tree at " + node);
		if (visited.has(node)) return;
		visiting.add(node);
		for (const child of records) if (child.parent === node) visit(child.id);
		visiting.delete(node);
		visited.add(node);
		order.push(node);
	};
	visit(id);
	for (const node of order) {
		if ((await threadRecord(node)).archived) continue;
		if (archive) {
			while (true) {
				try { await integrateThread(node); break; }
				catch (error) {
					if (!(error instanceof ThreadMergeConflict)) throw error;
					const block = await resolveConflict(error);
					if (block) { result.blocked = { threadId: node, block }; return result; }
					if ((await threadRecord(node)).archived) break;
				}
			}
		}
		if ((await threadRecord(node)).archived) continue;
		const retired = await retireThread(await threadRecord(node), keepBranch, { discardIgnored });
		result.closed.push(...retired.closed);
		result.killed.push(...retired.killed);
		result.branchesDeleted.push(...retired.branchesDeleted);
		result.branchesKept.push(...retired.branchesKept);
		if (retired.kept) result.kept = [...result.kept ?? [], ...retired.kept];
	}
	result.killed = [...new Set(result.killed)];
	return result;
}

/** Spawn subtree, post-order: integrate into each ab-parent, then retire. Conflict waits for that agent's fresh done/blocked. */
export async function archiveThread(id: string): Promise<ThreadCleanup> {
	return cleanupTree(id, true, false, true);
}

/** Same retirement walk without merges. keepBranch preserves every owned branch in the walk. Ignored state setup
 * can't regenerate is moved aside (ThreadCleanup.kept) unless discardIgnored says the work was taken. */
export async function abandonThread(id: string, options: { keepBranch?: boolean; discardIgnored?: boolean } = {}): Promise<ThreadCleanup> {
	return cleanupTree(id, false, options.keepBranch ?? false, options.discardIgnored ?? false);
}
