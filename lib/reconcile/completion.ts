import type { Handle } from "../dispatch.ts";
import type { Tracker } from "../tracker.ts";
import type { CollectorRecord, GlobalRunState, ReviewedResult } from "./tracker-state.ts";

export interface CompletionContext {
	state: GlobalRunState;
	tracker: Tracker;
	save: () => void;
	pathOf: (into: string) => string;
	locked: <T>(work: () => Promise<T>) => Promise<T>;
}
export interface ReviewedLanding {
	slug: string;
	into: string;
	worker: Handle;
	workers: Handle[];
	collector?: CollectorRecord;
	result: ReviewedResult;
	/** Union of the destination's retained files and this reviewer's tests. */
	tests: string[];
}
export type LandingOutcome = { ok: true; head: string; replayed: boolean } | { ok: false; failure: string };

/** Keep the leaf's result even after its chain/worktree is removed. If no explicit
 * handoff summary exists, preserve the reviewed report as summary. */
export function reviewedResult(parent: string | null, handoff: Record<string, unknown>, report: string): ReviewedResult {
	throw new Error("Implement in persist-reconciler-landings-and-target-results");
}

/** Real integrate(keep:true), conflict/refusal probe, dependency prep, declared
 * gates, retained tests and packet validation. Persist intent before merge;
 * persist destination ledger + carried descendants before returning success.
 * Does not close issues or retire threads/collectors. */
export async function landReviewed(context: CompletionContext, input: ReviewedLanding): Promise<LandingOutcome> {
	throw new Error("Implement in persist-reconciler-landings-and-target-results");
}

/** Reconcile a merge which reached its target before ledger persistence failed,
 * proving preparedHead ancestry and replaying the same ledger transfer. */
export function recoverLandings(context: CompletionContext): void {
	throw new Error("Implement in persist-reconciler-landings-and-target-results");
}

/** Exact replay of pending owner-reaching results, child first. Record each
 * close only after Tracker.close returns; throw on failure and retry next tick. */
export function closeAtTarget(context: CompletionContext): void {
	throw new Error("Implement in persist-reconciler-landings-and-target-results");
}

/** The runtime calls this only after every recorded worker/collector was retired.
 * The operation and ledger remain as audit, with cleanup no longer pending. */
export function finishLandingCleanup(context: CompletionContext, slug: string): void {
	throw new Error("Implement in persist-reconciler-landings-and-target-results");
}
