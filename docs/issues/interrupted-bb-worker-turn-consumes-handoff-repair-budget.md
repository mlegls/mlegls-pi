---
stage: "done"
author: "session:thr_iyjqmze9yv"
assignee: "agent:auto-routine"
priority: 1
---
During Concept's `enter-a-chat-session-on-its-mission` run on 2026-11-19, @thread:thr_ujfyn282kd was interrupted three times while implementing the web-host ticket. The BB log pairs `Pi run interrupted unexpectedly; no automatic resume was attempted` with failed `turn/completed` events (seq 1447–1448, 2663–2664 and 3730–3731). The reconciler asked for an unambiguous status with `First nonblank line: (empty report)`. The first two nudges recovered valid checkpoints and resumed work. The third interruption escalated as `status (after 2 repairs)` with an empty report, even though the worker had left a clean, committed checkpoint.

The handler recovered the task state from the tracker and the worker branch. Could failed BB turns use interruption recovery from the preserved checkout and last checkpoint, with the actual error in any escalation? Keep the status-repair budget for a completed turn that lacks a parseable handoff. Unlike [[projects/mlegls-pi/issues/reconciler-misses-status-from-completed-turn-event]], the turns that triggered the nudges here ended in failure, with no valid final handoff to recover from those turns.

## Result

done — Rebased onto `b3050865`. Interrupted workers resume in place; reports from removed refinements still go to the owner. Typecheck passed, and the full suite finished with 293 passed, 2 skipped, 0 failed.

```yaml
commit: d97058a3
stories:
  - story: A completed empty handoff consumes a status retry.
    outcome: held
  - story: The first two interrupted turns resume in place without consuming status retries.
    outcome: held
  - story: The third interruption holds and tells the owner the actual error and preserved checkout.
    outcome: held
evidence:
  path: docs/attachments/interrupted-bb-worker-turn-consumes-handoff-repair-budget/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - The driver replayed the recorded BB interruption through a fake BB CLI; no live interruption was induced.
```

Evidence: [docs/attachments/interrupted-bb-worker-turn-consumes-handoff-repair-budget/index.md](../attachments/interrupted-bb-worker-turn-consumes-handoff-repair-budget/index.md)
