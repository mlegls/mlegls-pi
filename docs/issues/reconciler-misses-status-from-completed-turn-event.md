---
stage: "done"
priority: 1
assignee: "agent"
author: "session:thr_79y4adjv6d"
---
A BB worker can post a valid first-line `done` and still get the reconciler no-status nudge. On 2026-11-18 @thread:thr_79y4adjv6d repeated the successful implement handoff three times. BB's event log has the `agentMessage` at seq 1200 with first line `done`, followed by `turn/completed` at 1203 with `status: completed`. Passing `.data.item.text` from seq 1200 through `lib/report.ts` returned `{"status":"done","hasHandoff":true,"handoffError":null}`. The supervisor accepted the handoff from the conversation, but reposting did not advance the reconciler. This differs from [[projects/mlegls-pi/issues/handoff-without-a-first-line-status-escalates-after-repairs]], where the worker omitted the sentinel.

`lib/thread/turn.ts` pairs the completion event with a separate `bb thread output` call and drops message events. `bb thread output … --json` returned empty on the next active turn; that does not establish what it returned at the earlier poll. Check for a race in the latest-output projection. One repair candidate is to bind the final agent message to the completed turn in the event log and retain it across pages. Workaround: recover the handoff directly from the recorded message for the completed turn; repeating the report alone did not help.

On 2026-11-19 the same symptom occurred for `waiting`: @thread:thr_579z45iect#msg=315 and @thread:thr_579z45iect#msg=581 each begin `waiting` and name `route-replays`; BB logged completed turns at seq 318 and 584. The reconciler sent two no-status nudges with first nonblank line `(empty report)`, then held the drive with `status (after 2 repairs)`. The driver was still observing progress in the same process, and had committed evidence `03f0119e8`. Resume that driver in place rather than restarting the deployment or replay.

In the same day's `let-a-node-name-how-its-evidence-goes-stale` run, worker @thread:thr_53rigwq8up was first interrupted (failed completion seq 1477), then posted two `checkpoint` handoffs after recovery (@thread:thr_53rigwq8up#msg=1672 and @thread:thr_53rigwq8up#msg=1713, completed turns seq 1675 and 1716). Each completed checkpoint was followed by an `(empty report)` nudge and the reconciler escalated `status (after 2 repairs)`. The handler recovered the task state from the issue and worker commit `5c0f5ecdd`; the same checkout also held an unpromoted local capture.

On 2026-11-20 the Create Mission recording worker posted `waiting` with the live process named (@thread:thr_rc34md3zgu#msg=1339, BB completed turn seq 1342); the next request was an `(empty report)` repair nudge (seq 1343). Another empty-report nudge is at seq 1407. The reconciler held the worker with `status (after 2 repairs)` even though its capture checkout and progress reports were available. The handler recovered the latest handoff from BB and resumed the same checkout (@thread:thr_uvwj6yr59b).

On 2026-11-20 the concept worker @thread:thr_hmrmry8wrb (notebook-projections-time-out-again-after-the-problem-release) posted first-line `waiting` twice and then `checkpoint`; each was followed by an `(empty report)` nudge and two `status (after 2 repairs)` escalations to the owner, who answered with the handoff recovered from `bb thread messages`.

On 2026-11-20 two more held workers the same way within minutes under heavy host load: unsaved-quiz-problem-reference-fences-the-tutor-turn and materials-only-commits-run-the-full-typecheck-hook in concept, each after `waiting`. Priority raised to 1: every long wait now escalates to the owner.

On 2026-11-20 the Concept roleplay-opening worker posted a valid `done` with commit and setup at @thread:thr_v5wtzb88yp#msg=1113 (BB completed turn seq 1116). Two `(empty report)` repairs (seq 1122 and 1176) led to `status (after 2 repairs)` with a blank report in the handler prompt. `bb thread log --message 1113` recovered the complete original handoff; `bb thread output` returned only the later repair report.

## Result

done — Replayed three recorded BB handoffs with empty thread output and a poll between message and completion. Each returned its original body and status: `done`, `waiting`, and `checkpoint`. All 11 affected checks passed. No code repair was needed.

```yaml
commit: 38302879
stories:
  - story: A completed implement handoff advances to drive after the output projection is cleared.
    outcome: held
evidence:
  path: docs/attachments/reconciler-misses-status-from-completed-turn-event/index.md
  visual: false
  shots: []
tests:
  - lib/thread/turn.test.ts
  - lib/wm.local.test.ts
  - lib/reconcile/setup.test.ts
  - lib/reconcile/unreadable-log.test.ts
filed: []
caveats:
  - Compaction timing was simulated; the split-poll replays used actual incident events.
```

Evidence: [docs/attachments/reconciler-misses-status-from-completed-turn-event/index.md](../attachments/reconciler-misses-status-from-completed-turn-event/index.md)

Recurrence 2026-11-22: Concept keep-development-versions-on-main-as-prereleases-implement-1 (thr_8ri6jb93up) reported done at ef7dea0356 about ten hours earlier; the reconciler last logged its 06:44 waiting status and stayed in implement through four restarts.

A different cause: `readTurn` returned that `done` (seq 993) on every poll. The maintainer closed the issue as superseded at 06:44:55 UTC (Concept 5fb488bf26), and `visit()` returned `done` for a satisfied node before reaching its chain, so the chain was never handled and nothing was raised. A node closed under its running chain now raises owner exception `closed outside the run while its chain runs`; reopening it withdraws the exception and the worker's latest report is handled as usual (1ca8d8dd, `lib/reconcile/closed-chain.test.ts`).
