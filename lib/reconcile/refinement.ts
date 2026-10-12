import type { Handle } from "../dispatch.ts";
import type { Tracker } from "../tracker.ts";
import type { GlobalRunState, RefinementAttempt } from "./tracker-state.ts";

export interface RefinementContext {
	state: GlobalRunState;
	tracker: Tracker;
	save: () => void;
	/** Stop the exact writer, including a registered launch with no saved receipt.
	 * Failure is fatal to cleanup/adoption: never delete beneath a live writer. */
	stopWriter: (attempt: RefinementAttempt) => Promise<void>;
	locked: <T>(work: () => Promise<T>) => Promise<T>;
}
export interface RefinementAcceptance {
	worker: Handle;
	children: string[];
	reportTs: string;
	report: string;
	/** Code/stubs land in this collector; this is not a completion ledger entry. */
	into: string;
	destination: string;
}
export type RefinementOutcome = { kind: "promoted" | "decomposed"; children: string[] };

/** Save original subtree identities + parent fields before the writer launches. */
export function beginRefinement(context: RefinementContext, node: string, handle: string): RefinementAttempt {
	throw new Error("Implement in own-provisional-refinement-through-global-tracker");
}

/** Discover creates by exact attempt claim and original baseline, including a
 * create published before a crash but not yet observed by the running loop. */
export function observeRefinements(context: RefinementContext): void {
	throw new Error("Implement in own-provisional-refinement-through-global-tracker");
}

/** Stop first, persist cleanup intent, prune only still-owned new descendants,
 * and restore a valid parent residual stage. Idempotent across partial writes. */
export async function discardRefinement(context: RefinementContext, handle: string): Promise<void> {
	throw new Error("Implement in own-provisional-refinement-through-global-tracker");
}

/** A checkpoint is adoption; an owner retry adopts only with adopt:true. Save
 * successor ownership before changing any old token; an ordinary replacement
 * discards first and gets a new post-cleanup baseline. */
export async function replaceRefinement(context: RefinementContext, oldHandle: string, newHandle: string, adopt: boolean): Promise<RefinementAttempt> {
	throw new Error("Implement in own-provisional-refinement-through-global-tracker");
}

/** Persist acceptance report, re-read/validate global promotion/decomposition,
 * land committed stubs with keep:true, then convert owned claims to reconcile:<root>.
 * Replay accepting state by saved prepared-head ancestry, not report cursor. */
export async function acceptRefinement(context: RefinementContext, handle: string, input: RefinementAcceptance): Promise<RefinementOutcome> {
	throw new Error("Implement in own-provisional-refinement-through-global-tracker");
}

/** Resume interrupted cleanup/adoption/acceptance before scheduling descendants. */
export async function recoverRefinements(context: RefinementContext): Promise<void> {
	throw new Error("Implement in own-provisional-refinement-through-global-tracker");
}

/** Relinquish only this run's reservation/attempt claims on a moved-out subtree. */
export function releaseRefinementClaims(context: RefinementContext, node: string): void {
	throw new Error("Implement in own-provisional-refinement-through-global-tracker");
}
