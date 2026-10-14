import { expect, test } from "bun:test";
import { nextReviewAction, replyMarkerPrefix } from "./pr-reviews.ts";
import type { PullRequestLanding, PullRequestSnapshot, ReviewThread, SubmittedReview } from "./pr-types.ts";

const pr = { reviews: { processed: [], repaired: [], replies: {} } } as unknown as PullRequestLanding;
const review = (id: string, at: string): SubmittedReview => ({ id, state: "COMMENTED", submittedAt: at, commit: "c" });
const snapshot = (reviews: SubmittedReview[], threads: ReviewThread[]) =>
	({ url: "u", head: "h", reviews, threads }) as unknown as PullRequestSnapshot;
const ownBody = replyMarkerPrefix("root") + "R1:thread:T1:head:abc";

test("the reconciler's own thread reply does not start another repair, but a human review in that thread does", () => {
	const thread = (comments: ReviewThread["comments"]): ReviewThread => ({ id: "T1", resolved: false, comments });
	const own = { id: "c2", reviewId: "own", body: "Fixed.\n\n" + ownBody };
	const ignored = nextReviewAction(pr, snapshot([review("own", "2026-01-02T00:00:00Z")],
		[thread([{ id: "c1", reviewId: "R1", body: "fix" }, own])]), "root");
	expect(ignored).toEqual({ kind: "none", processed: ["own"] });
	// another root's marker is not ours
	expect(nextReviewAction(pr, snapshot([review("own", "2026-01-02T00:00:00Z")], [thread([own])]), "other").kind).toBe("repair");
	const human = nextReviewAction(pr, snapshot([review("own", "2026-01-02T00:00:00Z"), review("h", "2026-01-03T00:00:00Z")],
		[thread([own, { id: "c3", reviewId: "h", body: "still wrong" }])]), "root");
	expect(human.kind).toBe("repair");
	if (human.kind === "repair") expect(human.request.reviewIds).toEqual(["h"]);
	expect(human.processed).toEqual(["own"]);
});
