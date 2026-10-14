# Submitted-review lifecycle first use

**Seeded API sequence — not live GitHub.** Nonvisual CLI/library encounter.
Product revision: 8580c2c6e14cba16649ca2e9811b6c61b1f0870e.
The [one-off probe](probe.ts) is acceptance machinery, not a retained test suite.

## Setup and replay

From a checkout with completed `mise run setup`, run:

    bun docs/attachments/reconcile-submitted-pr-reviews/probe.ts

Requires Bun, Git, mise and zmx on PATH. No credentials are required. Each invocation owns a disposable `/tmp/rc-pr-lifecycle-*` repository, bare remote, owner checkout, contributor checkout, staging worktree and isolated board/registry/state/cache. The fixture uses a local vault tracker and `pr-review` mode. Its shell `pi` substitute launches through real dispatch/runtime: `repair-1` itself edits `root.txt` and commits the repair; the probe supplies its reviewed board handoff and thread replies. Host snapshots/reply storage/review links and initial root phase handoffs are seeded.

The probe opens its story surface by actually publishing the staging branch and creating seeded PR 17 through the lifecycle, then drives `advancePullRequest`. Readiness was observed as the published PR receipt and started shell worker, not inferred from a URL. Remote merges use real Git history; the host merge API is never invoked. All workers and scratch resources are retired/deleted in `finally`. Nothing remains running; no ignored worktree state is needed.

A live rehearsal is separate: it requires an owned GitHub scratch repo and a distinct authorized reviewer identity (GitHub prohibits self-review). This packet does not establish live review submission, GraphQL replies or hosted CI.

## Final encounter: 2026-10-14

Replay exited 0 in 62 seconds, including typecheck.

| Claim / action | Observed result |
| --- | --- |
| Lone comment without submitted review | No repair worker launched. |
| Approval without unresolved associated threads | Submitted ID `quiet` durably processed; no worker. Approval made no merge call. |
| Submitted boundaries and coalescing | R1 CHANGES_REQUESTED and R2 COMMENTED coalesced into one saved request, in submission order; only unresolved associated T1/T2 requested. Resolved and lone threads excluded; prompt included bodies, paths, line and links. |
| Latest fetched PR HEAD | Real contributor push preceded submission; request and worker parent matched that contributor commit. |
| Repair, gates, push, replies | Shell worker committed code; integration preserved contributor ancestry; five exact-head gate runs occurred. Each requested thread received its completed-work reply after push. Pre-push hooks and gate receipts were checked against exact head. |
| Post-before-save interruption / restart | First host reply posted then threw before its receipt saved. Reloading persisted state replayed the same marker without duplicate, posted T2, finished the same request and retired its worker. Exactly two posts, one worker. |
| Review arriving during repair | `during` was not consumed when the worker completed; it remained available and was durably processed on the following tick. |
| Repeat observation | Same review IDs/threads yielded no new worker or replies. |
| Second changes-requested / dismissal | Dismissed R1, submitted later changes-requested with T3: root owner exception, no second worker. Exception included PR/review/thread material and prior repair head/reply receipts. |
| Human-only merge / completion | Zero host merge calls throughout. Explicit contributor-side merge advanced remote main; even with owner held, MERGED observation fetched/proved ancestry and target completion closed root at `github:seeded/lifecycle:main`. Original reviewed handoff and summary survived. |

## Actual identities

Real Git commits and runtime identity from the final disposable run, not hosted GitHub identities:

- Contributor HEAD: `e462bdc8a24df5ad16bb9dff4d3a2e0f252d21d0`
- Shell repair commit: `2c88169684c9707964bfd12359149c377290c7c0`
- Gated/pushed HEAD: `e8ed466227b62e141ca6681f57850452cf8ad239`
- Human-side merge commit: `403fa42b811ba2e53f4411fd8964e5eb9182d620`
- Worker run/handle: `root/repair-1`
- Worker thread: `2c9b987b-c1df-4ce5-bc64-47bda1266502`
- Retired checkout: `/private/tmp/rc-pr-lifecycle-JzbmhS/repo__worktrees/repair-1`
- Markers: `reconcile:root:review:R1,R2:thread:T1:head:e8ed466227b62e141ca6681f57850452cf8ad239` and the equivalent `thread:T2` marker.
- Replies: “Fixed T1 in 2c88169684c9707964bfd12359149c377290c7c0” and equivalent T2 reply.

## Regression checks and limits

- `bun run typecheck`: passed, including probe.
- `bun test lib/reconcile`: 13 passed, zero failed.
- `bun test`: 225 passed, two existing skipped, zero failed (51 files).
- No new permanent tests added.
- An earlier probe assertion compared the whole result object across legitimate target-completion metadata updates. It was narrowed to preserved original handoff/summary; final encounter replayed successfully.
- Implementer first use above; [independent driver replay](drive.md) on revision `4166ee2438f6eddd84a5717cff5606ce4ab3885f` also exited 0 with one repair worker, two reply posts and zero host merge calls. Reviewer acceptance follows.

## Review pass (2026-10-14)

Defect found by reading the diff against GitHub's reply behaviour: `host.reply` posts the reconciler's thread reply as its own submitted COMMENTED review inside the still-unresolved thread, so each repair's replies would have been selected as a new actionable review and looped until the repair budget ran out. The seeded probe cannot show this (its reply storage creates no review).

Repair: `nextReviewAction(pr, snapshot, root)` ignores a submitted review whose comments all carry `reconcile:<root>:review:` (shared via `replyMarkerPrefix`, also used to build reply markers), judged by marker rather than author; such IDs are durably processed. A human COMMENTED/CHANGES_REQUESTED review in the same thread still triggers, and a thread is requested only through the reviews that selected it, so a thread whose latest comment is the reconciler's reply is not re-requested unless a later human review comments in it. Retained test: `lib/reconcile/pr-reviews.test.ts`. Re-ran typecheck, `bun test lib/reconcile` (14 pass) and the seeded probe (exit 0 again: one worker, two replies, zero merge calls).
