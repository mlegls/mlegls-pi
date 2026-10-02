---
stage: idea
assignee: agent
author: session:86d24b04-f507-431f-be52-5c33b3e2f361
---

During [[projects/concept/issues/gate-supervised-integration-on-the-kept-browser-batch]], started managed `proc_2` (`mise run pre-integrate`) at 2026-10-02 04:06 UTC in the same worker session. It remained idle awaiting the process tool's automatic completion notification. The root supervisor later observed that the process had completed at 04:12 UTC, but the waiting worker had not received its completion notice. Root mailed the retained combined-log path at 04:55 UTC; the worker then consumed its actual failed-task receipt, restored the diagnostic assertion and continued. The automatic `proc_2` exit-1 notice eventually arrived after the green gate had finished and the next process had started, reporting a 56m56s duration. This establishes a delayed wake, not permanent notification loss; the discrepancy with root's 04:12 terminal observation is unresolved. [[projects/concept/attachments/gate-supervised-integration-on-the-kept-browser-batch/index|Evidence packet]].

No process restart, duplicate trial, lost test outcome or new worktree/session occurred in this encounter. `process output proc_2` could still recover the retained output after root's notice. The worker had ended with `blocked` pending-process reports under the old sentinel contract; root then introduced `waiting` and the worker replied `waiting (proc_2)`. Whether notification delivery, report suspension or exception handling caused the missing wake is not established.

Owner: mlegls-pi process notifications and reconciler waiting/report handling. Workaround was the root's one-off terminal-result notice with the existing log, not polling or a second process. Related inherited-session ownership observation: [[projects/mlegls-pi/issues/checkpoint-continuation-cannot-observe-inherited-managed-processes]]; this encounter retained the original session, so it does not establish that same cause.
