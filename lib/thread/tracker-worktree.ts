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
 * target. Disable rename detection so moves out of the tracker include deletions. */
export function assertNoTrackerChanges(cwd: string, target: string, source = "HEAD"): void {
	const base = git(cwd, "merge-base", target, source);
	const paths = git(cwd, "diff", "--no-renames", "--name-only", "-z", base, source, "--", ":(top)docs/issues/")
		.split("\0").filter(Boolean);
	if (paths.length) throw new Error("Forbidden tracker changes: " + paths.join(", ") + ". Mutations belong through the tracker, not code branches.");
}
