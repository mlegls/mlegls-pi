---
priority: 4
stage: done
author: session:01a0e2d3-2fe3-706a-8616-9394e05449d1
---

Obsolete 2026-10-01: the dsh port was deleted in the pi 0.99 rebuild (`4b79baa`).

While trying the fork/join story in [[projects/mlegls-pi/issues/archive/dsh-templated-spawn-and-dispatch]], the headless host exited after its parent became idle even though a continuable child had only sent an intermediate message. Child `7e8b48df-8ecd-4a35-9c94-9ecef9d98634` in isolated home `dsh/.local/dispatch-first-use-6` had a durable tool-call message but no final turn/end; its board topic `mail/f9d98634` had only `started`. The parent acknowledged the intermediate message and finished, ending the host before child settlement.

The pinned runner waits for the parent with `agent.whenIdle()` and then exits. Keeping the parent busy with a short shell wait allowed a later child to finish and publish `turn-end`; that does not test idle-parent wake. Use persistent Web for that story. Decide whether headless should drain admitted children or explicitly document parent-only lifetime upstream.

decision, 2026-09-30: deferred while DSH isn't the daily harness (its upstream tracker is disabled).
