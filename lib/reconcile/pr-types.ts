import type { Handle } from "../dispatch.ts";

/** Per-run choice; absent in an existing state means the pre-PR local mode. */
export type LandingMode = "local" | "pr-merge" | "pr-review";

export interface GitHubProject {
	repository: string; // owner/name
	remote: string; // local Git remote for that repository
	baseBranch: string; // repository default branch, captured at start
}
export interface ReportedCheck {
	id: string;
	name: string;
	state: "pass" | "pending" | "fail";
	url?: string;
	details?: string;
}
export interface SubmittedReview {
	id: string;
	state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
	submittedAt: string;
	commit: string;
}
export interface ReviewThread {
	id: string;
	resolved: boolean;
	comments: { id: string; reviewId?: string; body: string; path?: string; line?: number; url?: string }[];
}
export interface PullRequestSnapshot {
	number: number;
	url: string;
	state: "OPEN" | "MERGED" | "CLOSED";
	headBranch: string;
	head: string;
	baseBranch: string;
	base: string;
	mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
	checks: ReportedCheck[]; // all check runs AND status contexts on this exact head
	reviews: SubmittedReview[];
	threads: ReviewThread[];
	mergedAt?: string;
	mergeCommit?: string;
}

export interface PullRequestHost {
	project(cwd: string): GitHubProject;
	/** All states, so an interrupted create never opens a second PR. */
	find(cwd: string, repository: string, headBranch: string): PullRequestSnapshot | undefined;
	create(cwd: string, repository: string, input: { headBranch: string; baseBranch: string; title: string; body: string }): PullRequestSnapshot;
	observe(cwd: string, repository: string, number: number): PullRequestSnapshot;
	checks(cwd: string, repository: string, commit: string): ReportedCheck[];
	/** Merge commit only, with a compare-against-head guard. Never an auto-merge enrolment. */
	merge(cwd: string, repository: string, number: number, expectedHead: string): void;
	/** marker is included in the reply; an existing marker makes this a successful replay. */
	reply(cwd: string, repository: string, threadId: string, body: string, marker: string): void;
}

export interface PrRepairRequest {
	key: string; // stable identity of the observed trigger, not a poll timestamp
	kind: "checks" | "base" | "review";
	head: string;
	message: string;
	reviewIds?: string[];
	threadIds?: string[];
}
export interface PrRepairReceipt {
	request: PrRepairRequest;
	worker?: Handle;
	launchedAt?: number;
	handledTs?: string;
	preparedHead?: string;
	pushedHead?: string;
	handoff?: Record<string, unknown>;
	/** Review worker supplies a reply for each requested thread in its handoff. */
	threadReplies?: Record<string, string>;
}
export interface PrReviewProgress {
	processed: string[]; // submitted review IDs only
	repaired: string[]; // persisted only after repair integration and push
	replies: Record<string, string>; // replay marker -> posted reply receipt
	lastRepair?: { at: string; head: string; reviewIds: string[] };
}

/** Durable publication/wait receipt. Branch/worktree are owned independently of phase workers.
 * Ledger entries stay in path until MERGED is observed and fetched ancestry is proven. */
export interface PullRequestLanding extends GitHubProject {
	path: string;
	branch: string;
	phase: "preparing" | "opening" | "waiting" | "repairing" | "merged" | "closed";
	number?: number;
	url?: string;
	preparedHead?: string;
	pushedHead?: string;
	lastPolledAt?: string;
	baseHead?: string;
	mergeCommit?: string;
	mergedAt?: string;
	repair?: PrRepairReceipt;
	repairs: number;
	integrationFailures: number;
	reviews: PrReviewProgress;
	/** Local fetch/ff after remote landing is best-effort, not part of tracker close eligibility. */
	ownerSync?: "updated" | "left";
}

export type PrReviewAction = (
	| { kind: "none" }
	| { kind: "repair"; request: PrRepairRequest }
	| { kind: "exception"; reason: string; message: string }
) & { processed: string[] }; // non-actionable submitted IDs the caller may durably consume
