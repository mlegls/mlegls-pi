import type { Issue } from "../tracker.ts";
import type { LandingLedger } from "./tracker-state.ts";

/** Private run view. done remains canonical; satisfied is collector-local. */
export interface ScheduledIssue extends Issue {
	blockers: string[];
	satisfied: boolean;
	provisional: boolean;
}
export interface SchedulingContext {
	root: string;
	into: string;
	landed: LandingLedger;
	/** Only recorded, active/adopting attempt tokens; never a prefix match. */
	attemptClaims: ReadonlySet<string>;
	/** Unaccepted owned descendants, including creates found after restart. */
	withheld: ReadonlySet<string>;
	/** Mirror the CLI's explicit-scope deferral exception for this selection. */
	explicit?: boolean;
}

/** Rebuild lifecycle rollups from ownStage/relations/guards and own claims.
 * No mutations of global rows and no branch or tracker IO. */
export function schedulingView(global: ReadonlyMap<string, Issue>, context: SchedulingContext): Map<string, ScheduledIssue> {
	throw new Error("Implement in project-collector-local-tracker-lifecycle");
}
