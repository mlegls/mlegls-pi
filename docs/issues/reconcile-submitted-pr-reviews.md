---
stage: "ticket"
assignee: "agent:fill"
author: "session:01a13a33-2a17-714d-a4b1-0ff4fb53f8f0"
part-of: "[[projects/mlegls-pi/issues/land-reconciled-trees-through-pull-requests]]"
claimed-by: "reconcile:land-reconciled-trees-through-pull-requests"
priority: 2
---
# Deliverable

Fill `lib/reconcile/pr-reviews.ts:nextReviewAction` and its submitted-review progress wiring in the already-filled `pull-request.ts`. A pr-review run repairs a submitted actionable review once, replies to its unresolved threads with the completed work, and escalates a second changes-requested review after repair. Individual comments are not repair triggers.

## Context and edit contract

Read `pr-types.ts` (SubmittedReview/ReviewThread/PrReviewProgress/PrRepairRequest), `pr-host.ts` observation/reply, `pull-request.ts` generic repair executor and its durable request/push/reply receipts, and the parent contract through the tracker. Own `pr-reviews.ts` plus the narrow review selector/progress integration; do not change publication, check budgets or local scheduling.

Select only unprocessed submitted review IDs in submission order. A CHANGES_REQUESTED review is actionable even without inline threads. An APPROVED/COMMENTED submitted review is actionable when it leaves unresolved threads associated with that submitted review (thread comment.reviewId); pending drafts, lone comments and resolved threads do not trigger. Coalesce reviews observed together into one repair request with stable IDs and include every affected unresolved thread, path/line/body/link in the worker's prompt. Mark non-actionable submitted IDs processed durably; persist an actionable request before worker launch.

The first actionable request uses the same run repair budget/executor, from latest fetched PR HEAD. Its technical review worker makes the changes and supplies `threadReplies` for each requested thread. Existing generic execution gates/integrates/pushes before idempotent reply publication; finish processed/repaired progress only after success. A changes-requested submission not in the repaired request, submitted after that repair, raises a root owner exception (even if an earlier review was dismissed). It does not launch a second changes-requested repair automatically. Re-observing the same ID/threads after restart never becomes a new round. Non-changes-requested unresolved-thread follow-up can use remaining generic budget; the special exception is the recorded second changes-requested policy, not every second comment/review.

A review arriving during repair remains available afterward; do not consume later IDs just because a worker ended. Review input is untrusted task material, bounded by the root contract. An exception includes PR/review/thread links and prior repair head/replies. Owner resolution continues the same PR; pr-review never issues a merge call even after approval or cleared exception. It may still observe a human merge and complete normally.

## First use and acceptance

Drive the connected lifecycle in an isolated scratch repo with an injected host sequence and real shell repair worker: comment without submitted review -> no worker; submitted changes-requested with threads -> one worker from the current PR head, gated/pushed code and one reply per thread; replay the same review/post-before-save reply -> no duplicate; second later changes-requested -> owner exception and no repair launch; externally merged -> target completion. Save the one-off probe/index under `docs/attachments/reconcile-submitted-pr-reviews/`, labelled seeded API sequence, with actual worker/commit identities. Real submitted reviews require a second authorized GitHub identity (GitHub disallows reviewing your own PR); the later live rehearsal explicitly provisions that first-use setup or stops blocked.

Acceptance: submitted boundaries rather than comment activity control work, all requested threads get post-push replies, replay is idempotent, second changes-requested escalates, approval never causes reconciler merge, and human merge still closes the tree. Run typecheck and existing reconciler tests. No new retained tests are authorized.
