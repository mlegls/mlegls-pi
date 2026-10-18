import { execFileSync } from "node:child_process";
import { git } from "./git.ts";

/** Exclude docs/issues/ before prepare/setup/launch. Sparse absence is an index
 * setting, not a commit deleting files; attachments and every other path remain. */
export function excludeTracker(cwd: string): void {
	git(cwd, "sparse-checkout", "init", "--no-cone");
	execFileSync("git", ["-C", cwd, "sparse-checkout", "set", "--no-cone", "--stdin"], {
		input: "/*\n!/docs/issues/\n", stdio: ["pipe", "pipe", "pipe"],
	});
	git(cwd, "read-tree", "-mu", "HEAD");
}

/** Compare source's authored changes, not canonical persistence inherited from
 * target. Disable rename detection so moves out of the tracker include deletions.
 * Canonical persistence also reaches a branch that merges the main checkout (a join's implementer that merged main
 * into a collector-based branch, 2026-10-18): paths whose content is the main commit it carries aren't its changes. */
export function assertNoTrackerChanges(cwd: string, target: string, source = "HEAD"): void {
	const changed = (from: string) => git(cwd, "diff", "--no-renames", "--name-only", "-z", from, source, "--", ":(top)docs/issues/")
		.split("\0").filter(Boolean);
	let paths = changed(git(cwd, "merge-base", target, source));
	if (paths.length) {
		const first = git(cwd, "worktree", "list", "--porcelain", "-z").split("\0")[0];
		const main = first?.startsWith("worktree ") ? git(first.slice("worktree ".length), "rev-parse", "HEAD") : "";
		let carried = "";
		try { carried = main ? git(cwd, "merge-base", main, source) : ""; } catch {}
		if (carried) { const authored = new Set(changed(carried)); paths = paths.filter(path => authored.has(path)); }
	}
	if (paths.length) throw new Error("Forbidden tracker changes: " + paths.join(", ") + ". Mutations belong through the tracker, not code branches.");
}
