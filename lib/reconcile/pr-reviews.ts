import type { PrReviewAction, PullRequestLanding, PullRequestSnapshot } from "./pr-types.ts";

/** Set true when nextReviewAction is filled; until then advancePullRequest never calls it. */
export const prReviewLifecycleReady = false;

/** Filled by reconcile-submitted-pr-reviews. Pure selection; caller persists progress. */
export function nextReviewAction(_pr: PullRequestLanding, _snapshot: PullRequestSnapshot): PrReviewAction {
	throw new Error("reconcile-submitted-pr-reviews has not filled nextReviewAction");
}
