---
stage: done
assignee: agent
priority: 2
part-of: "[[projects/mlegls-pi/issues/supervise-loop-reliability]]"
author: session:01a0f0f1-30ca-77c1-8c28-86f09321af7d
---

A worker that dies on a provider error posts nothing to the board, and its parent keeps waiting on it. Observed in the 2026-09-15 factor-finish/materials run ([research](../research/role-model-spikiness-2026-09-30.md), [ledger](../attachments/role-model-spikiness/acceptance.json)):

- `u2-selfgrade-rereview` (glm-flash) ended at turn 4 with `stopReason: error` ("Provider finish_reason: error") at about 12:42Z. The parent wrote "Waiting on … `u2-selfgrade-rereview`" at 13:05, 13:10, 13:21 and 13:22, first looked at the topic at 16:13:22 ("exited without posting a report"), and respawned at 16:14:41 (parent session lines 811-855, 990-1000). Detection latency 3.5 h; the dead attempt cost $0.003.
- `guard-review-2` (glm-flash) died the same way at turn 11 and its replacement session started 75 s after the last message, so detection is not a property of the model or the error.
- `lifecycle-drive-2` (sonnet, 13:35Z) died on a provider 400 and was re-run at 13:47Z.
- `u6-review` (astra) ended normally without a board send; replacement started 36 s later.

The worker session file records the death (`stopReason: error`), but `wm.ts status` at 16:13 listed the dead worker as `done` beside workers that had reported, so process status alone does not distinguish a death from a report.

Idea: whichever owner emits worker liveness to a parent (today `wm.ts status` and the board; `ab supervise` since) could post or wake on "worker session ended without a `done`/`blocked`/`needs-input` report". Related existing owner: [[projects/mlegls-pi/issues/archive/surface-stale-waits-after-owner-replies]] covers stale waits after replies, not deaths without a report.

third case, 2026-09-30: the first [[projects/mlegls-pi/issues/archive/tracker-obsidian-rollout]] worker died at 05:29Z on a provider `{"detail":"Bad Request"}` ([[projects/mlegls-pi/issues/computer-use-images-poison-worker-context]]). The pi process stayed alive and idle, so no child-exit fired and `ab supervise status` showed `implement` for about 6.5 h until the user asked why every child was idle. A steer mail revived it, and it died the same way within a minute; status again showed `implement`. The session file's mtime kept moving because `board-cursor` custom entries are appended after the death, so mtime is not a liveness signal either.

fourth case, 2026-09-30: this ticket's worker turn itself ended mid-edit on a provider error (`WebSocket closed 1006`) at about 14:40Z. The parent received no report or further work from it and surfaced the stall at 17:19:40Z, roughly 2h40 later. This is another observed case of a worker failure remaining silent to its owner.
Detection that would have caught all four: a worker session whose last `message` entry is an assistant turn with `stopReason: "error"`, followed only by `custom` entries for more than a few minutes, is a dead child and should produce exception mail. This is the same class of problem as [[projects/mlegls-pi/issues/worker-start-check-misses-long-first-turns]]: the loop reads a liveness signal that doesn't track the worker (the session `.jsonl` existing, or the pi process existing).

ticket contract, 2026-09-30: the loop detects a dead worker from its session file (last `message` entry an assistant turn with `stopReason: "error"`, followed only by `custom` entries for more than a few minutes) and sends exception mail naming the error, the session path and its size. Status shows the child as dead rather than in its phase. First use: a worker whose provider call fails (a fixture or an injected error) produces that mail within minutes, and a healthy long turn doesn't.

## First-use evidence

[Encounter packet](../attachments/parent-waits-on-worker-that-died-without-a-report/index.md): the driver's null setup left all three claims unobserved; review replayed them through `lib/jobs/fixtures/worker-death.ts` (provider-error mail naming error, session path and size; status `dead`; no mail for healthy or redispatched turns), retained as `lib/jobs/worker-death.test.ts`. Not exercised: a live provider failure against a real pi process.

## Verification evidence

[Encounter and evidence](../attachments/parent-waits-on-worker-that-died-without-a-report/index.md).
