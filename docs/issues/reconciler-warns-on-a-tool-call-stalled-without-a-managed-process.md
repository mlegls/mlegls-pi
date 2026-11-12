---
stage: "ticket"
assignee: "agent"
priority: 2
author: "thread:thr_879y94y97m"
---
The final review of Concept's `make-large-card-imports-scale-in-one-tutor-script` tree, @thread:thr_mjg3wfmkct, sat 16h 40m in one bash call (11-10 22:32Z to 11-11 15:12Z) and nothing noticed: the reconciler's stall alarm (`waiting stalled` in [lib/reconcile/reconcile.ts](../../lib/reconcile/reconcile.ts)) only covers workers that reported `waiting`. Found by the efficiency audit of 2026-11-12 (@thread:thr_879y94y97m). The cause of that one is [[projects/mlegls-pi/issues/bash-timeout-read-as-milliseconds-blocks-a-worker-for-hours]]; this catches any cause.

decisions:
- 2026-11-12: warn the supervisor when a worker's current tool call has run over 45 minutes with no managed process (maintainer, approving the audit's proposal).

## tasks
1. Beside the `waiting stalled` check, raise one `tool call stalled` exception for an active worker whose in-flight tool call is older than 45 minutes while it owns no running managed process, naming the tool and command.
2. A test beside the existing stall tests.

Done when: a worker blocked in a single 50-minute bash call raises the exception once, and one waiting on a managed process does not.
