---
stage: idea
author: session:01a0f0f1-30ca-77c1-8c28-86f09321af7d
---

A worker that dies on a provider error posts nothing to the board, and its parent keeps waiting on it. Observed in the 2026-09-15 factor-finish/materials run ([research](../research/role-model-spikiness-2026-09-30.md), [ledger](../attachments/role-model-spikiness/acceptance.json)):

- `u2-selfgrade-rereview` (glm-flash) ended at turn 4 with `stopReason: error` ("Provider finish_reason: error") at about 12:42Z. The parent wrote "Waiting on … `u2-selfgrade-rereview`" at 13:05, 13:10, 13:21 and 13:22, first looked at the topic at 16:13:22 ("exited without posting a report"), and respawned at 16:14:41 (parent session lines 811-855, 990-1000). Detection latency 3.5 h; the dead attempt cost $0.003.
- `guard-review-2` (glm-flash) died the same way at turn 11 and its replacement session started 75 s after the last message, so detection is not a property of the model or the error.
- `lifecycle-drive-2` (sonnet, 13:35Z) died on a provider 400 and was re-run at 13:47Z.
- `u6-review` (astra) ended normally without a board send; replacement started 36 s later.

The worker session file records the death (`stopReason: error`), but `wm.ts status` at 16:13 listed the dead worker as `done` beside workers that had reported, so process status alone does not distinguish a death from a report.

Idea: whichever owner emits worker liveness to a parent (today `wm.ts status` and the board; `ab supervise` since) could post or wake on "worker session ended without a `done`/`blocked`/`needs-input` report". Related existing owner: [[projects/mlegls-pi/issues/surface-stale-waits-after-owner-replies]] covers stale waits after replies, not deaths without a report.
