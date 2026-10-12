/** A successful code landing, independent of the issue's globally stored stage.
 * into follows Chain.into: collector issue slug, or the absolute owner checkout path.
 * head is the destination's code head immediately after integration; at is ISO-8601. */
export interface Landing {
	into: string;
	head: string;
	at: string;
}
export type LandingLedger = Record<string, Landing>;

/** Persisted shapes of the completion (completion.ts) and refinement (refinement.ts) protocols. */
export interface ReviewedResult {
	parent: string | null;
	summary: string;
	evidence?: string;
	handoff: Record<string, unknown>;
	closedAt?: string;
}

export interface CollectorRecord { path: string; branch: string; parentBranch: string }

/** Write-ahead receipt: preparedHead is saved after rebase/gates, before merge.
 * Recovery proves that exact code reached destination by Git ancestry, never issue blobs. */
export interface LandingOperation {
	slug: string;
	into: string;
	destination: string;
	before: string;
	worker: import("../dispatch.ts").Handle;
	preparedHead?: string;
	carried: string[];
	result: ReviewedResult;
	workers: import("../dispatch.ts").Handle[];
	collector?: CollectorRecord;
	landedHead?: string;
	at?: string;
	cleanupDone?: string;
}

export interface RefinementAttempt {
	node: string;
	handle: string;
	claim: string;
	baseline: string[];
	parentFields: import("../tracker.ts").Fields;
	owned: string[];
	phase: "writing" | "stopping" | "cleaning" | "adopting" | "accepting" | "accepted" | "removed";
	worker?: import("../dispatch.ts").Handle;
	successor?: string;
	adoptedFrom?: string;
	acceptance?: {
		reportTs: string;
		report: string;
		children: string[];
		into: string;
		destination: string;
		preparedHead?: string;
		landedHead?: string;
	};
}

/** The reconciler's State extends this. Missing landed is a manual rebuild,
 * not an empty ledger; the other maps are initialized with every new run. */
export interface GlobalRunState {
	root: string;
	cwd: string;
	landed: LandingLedger;
	results: Record<string, ReviewedResult>;
	landingOps: Record<string, LandingOperation>;
	refinements: Record<string, RefinementAttempt>;
}
