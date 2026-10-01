// Implemented by thread-archive-and-abandon. No wm/dispatch imports: those consumers delegate here.
import type { ThreadCleanup, ThreadIntegration } from "./types";

export class ThreadMergeConflict extends Error {
	constructor(readonly threadId: string, readonly branch: string, readonly parentBranch: string, readonly files: string[]) {
		super("conflicts merging " + branch + " into " + parentBranch + ": " + files.join(", "));
		this.name = "ThreadMergeConflict";
	}
}
/** One thread's git integration into ab-parent; no cleanup or automatic conflict messaging. Guest returns undefined. */
export async function integrateThread(_id: string, _options: {
	mode?: "rebase" | "merge";
	prepare?: (thread: import("./types").ThreadRecord) => Promise<void>;
} = {}): Promise<ThreadIntegration | undefined> { throw new Error("thread integration not implemented"); }
/** Spawn subtree, post-order: integrate into each ab-parent, then retire. Conflict waits for that agent's fresh done/blocked. */
export async function archiveThread(_id: string): Promise<ThreadCleanup> { throw new Error("thread archive not implemented"); }
/** Same retirement walk without merges. keepBranch preserves every owned branch in the walk. */
export async function abandonThread(_id: string, _options: { keepBranch?: boolean } = {}): Promise<ThreadCleanup> { throw new Error("thread abandon not implemented"); }
