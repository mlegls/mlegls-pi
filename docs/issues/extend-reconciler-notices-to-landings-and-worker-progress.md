---
stage: "ticket"
assignee: "agent"
priority: 2
author: "thread:thr_879y94y97m"
---
The concept supervisor @thread:thr_ihbpyrp6s2 still spends model turns on reconciler notices that need nothing from it. The efficiency audit of 2026-11-12 (@thread:thr_879y94y97m, both auditors) counted, over 11-09..11-12: 26 `[reconcile X] done: … landed` notices at $12.2 (7 of those replies used no tool), and about $8.5 more on `parked`, `withdrew` and `stopped` notices and on progress `bb thread tell`s from reconciler-owned workers that asked for nothing. Worker completion notices are already absorbed by [[projects/mlegls-pi/issues/drop-reconciler-worker-notices-in-a-bb-plugin]].

decisions:
- 2026-11-12: these notices join context without a model turn; landings are no longer announced in chat, and `reconcile_status` still lists them (maintainer, approving the audit's proposal in @thread:thr_879y94y97m).

## tasks
1. Extend [extensions/bb/reconciler-notices.ts](../../extensions/bb/reconciler-notices.ts) to treat `done … landed`, `parked`, `withdrew` and `stopped` notices, and `[bb message from thread:…]` messages from reconciler-owned workers, like completion notices. Keep a model turn when the notice carries a recorded follow-up for the supervisor or an exception.
2. Add to [agents/_common.md](../../agents/_common.md): "Report through your final handoff; don't `bb thread tell` your parent unless you need an answer."

Done when: a replay of those notice kinds leaves the supervisor idle with no model call, and an exception notice still wakes it.
