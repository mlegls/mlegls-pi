---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
---
---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
---
The reconciler keeps `desk/STATUS.md` (an untracked folder at the root of its target's main checkout) up to date, so the maintainer can see progress in bb without asking the supervisor.

Decided 2026-10-19 by the maintainer, while planning to drop reconciler workers' child-completion notices to the supervisor (`replace-the-board-with-bb-mail`). Those notices cost $640 in one week; the record they narrated is already in the reconciler's state and log (`reconcile_status`), but only as JSON behind a supervisor turn.

Done:
- Written by reconciler code, not by a model turn, whenever a node changes phase, lands, fails integration, or raises or resolves an exception.
- One section per running reconciler root. Each in-flight issue gets one line, newest first: its phase, the worker as `@thread:<bb id>` (bb renders it as a link), and what last happened (landed, sent back with the reason, waiting on an exception). Finished roots fold into a short "done" list with when they landed, and drop out a day after finishing. Pending exceptions are shown as waiting on the supervisor; what needs the maintainer stays in `ATTENTION.md`.
- Several reconcilers into the same checkout share one file without clobbering each other (for example, regenerate the whole file from every reconciler's state).
- `STATUS.md` is listed in the checkout's `.git/info/exclude`, as `ATTENTION.md` already is in concept and mlegls-pi.
- A test covers rendering from reconciler state; one live reconcile updates the file.
