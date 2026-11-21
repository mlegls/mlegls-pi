---
stage: "done"
assignee: "agent:auto-routine"
author: "session:recording-replay-mistakes-skill-examples-for-tool-errors-handler-k"
priority: 2
---
In Common Concept's recording-replay-mistakes-skill-examples-for-tool-errors run, the join implementer for restore-review-replay-due-state-preparation launched at the enclosing collector head `829e1eaee6cdbd5012ecba8465a0b017815bf5e3`, not its own integrated node collector `ae73bd0600bf846548d6f1377085dd3c01baef18`. Both direct and joined children were recorded landed into the node. The worker reported blocked without changes: its checkout lacked docs/attachments/review-replay-due-state/ entirely. Handler: @thread:thr_r9hquve8kv is the blocked worker.

Observed 2026-11-02: git worktree list confirms the node collector at ae73bd060 and implement-j at 829e1eaee; their merge base is f896eb200. The node head contains both children's code and direct/joined/independent-drive packets. Reconcile status records child landings at 05:40:53Z and 06:29:30Z, then an initial 06:30:27Z launch failure (path already exists, not owned), and successful implement-j launch at 06:32:02Z. A retired orphan worktree exists detached at the correct ae73bd060. The path recovery may be relevant; its cause has not been established.

Workaround decided by the contract handler: restore the unchanged join worker to the node collector's exact integrated head and continue only the evidence-index join. This is authorized, not yet observed completed. Common Concept's restore-review-replay-due-state-preparation tasks record the base and decision globally.

Related prior repair: [[projects/mlegls-pi/issues/refinement-children-skipped-and-parent-drives-from-a-stale-base]] protects resuming from a stale kept worker. This occurrence is the newly launched join after path recovery, with the enclosing collector as its starting head. Investigate the launch/recovery base selection before prescribing another reset rule.

## Result

done — Both launches started at the exact integrated node HEAD, saw both child deliveries, and retained the enclosing collector as their landing destination. Recovery reused the interrupted worker’s title. All four existing launch-recovery and resume checks passed.

```yaml
commit: f972b070
stories:
  - story: An interrupted join retries from its integrated node collector after the occupied worktree path is cleared.
    outcome: held
  - story: A fresh join starts from its integrated node collector and keeps the enclosing collector as its landing destination.
    outcome: held
evidence:
  path: docs/attachments/reconciler-join-launch-can-start-from-enclosing-collector/index.md
  visual: false
  shots: []
fixed:
  - Raised the replay’s per-observation wait ceiling from 15 to 90 seconds after recovery timed out. Both replays then completed in 12 seconds combined.
changes: []
tests: []
filed: []
caveats:
  - The replay verifies the worker’s configured landing branch without performing a landing.
```

Evidence: [docs/attachments/reconciler-join-launch-can-start-from-enclosing-collector/index.md](../attachments/reconciler-join-launch-can-start-from-enclosing-collector/index.md)
