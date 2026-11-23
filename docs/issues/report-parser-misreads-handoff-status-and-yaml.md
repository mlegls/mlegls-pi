---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> [report.ts](../../lib/report.ts#L46-L51) raises false status conflicts on standalone headings/bullets (`### Blocked`), picks the first YAML fence containing any key, and drops `visual-reviewer`'s `data:` handoff key.

Done when a report whose prose has a `### Blocked` heading or a `- blocked` bullet keeps its sentinel status, the handoff is the fence with handoff keys (the last such fence when several have them), and `visual-reviewer`'s `data` key survives parsing. Related: [[projects/mlegls-pi/issues/report-unrecognized-yaml-handoff-is-silent]].
