import { git } from "./checks.ts";

/** Carry landed collector decisions into a successor without rewriting its predecessor's history.
 * A conflict stays in the new checkout for the successor to resolve before doing its phase's work. */
export function refreshWorker(path: string, collector: string): { head: string; conflicts: string[] } {
	const head = git(collector, "rev-parse", "HEAD");
	const missing = git(path, "rev-list", "--count", "HEAD.." + head) !== "0";
	if (!missing) return { head, conflicts: [] };
	try { git(path, "-c", "merge.conflictStyle=diff3", "merge", "--no-edit", "--no-verify", head); }
	catch (error) {
		const conflicts = git(path, "diff", "--name-only", "--diff-filter=U", "-z").split("\0").filter(Boolean);
		if (!conflicts.length || git(path, "rev-parse", "MERGE_HEAD") !== head) throw error;
		return { head, conflicts };
	}
	return { head, conflicts: [] };
}
