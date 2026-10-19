---
stage: "done"
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

## Result

done

The reconciler regenerates `desk/STATUS.md` in the main checkout on every state write (`88107248`, `8ff495e4`, `01c12ad5`).

- **Where:** `lib/reconcile/status.ts`, called after each save in `updateState`. A write that fails logs a line and the reconciler carries on.
- **Content:** the whole file is rebuilt from every run's state in the repository's `.git/reconcile/`, so reconcilers sharing a checkout don't overwrite each other. It's only rewritten when the content changes. Each running root gets a section with one line per in-flight node, newest first: phase, the worker as `@thread:<bb id>`, the last log line naming it, and any pending exception. Landed nodes and a "Done" list follow.
- **Finished runs:** they drop out a day after they finish. The finish time is the root's landing or the run's last log line, whichever is later, since the state records no finish time.
- **Worker links:** the bb id comes from the registry record named by the worker's `threadId` (`ThreadRecord.bb`), because `bbIndex` was removed.
- **Exclude:** `desk/` is added to `.git/info/exclude` if it's missing.
- **Checks:** `lib/reconcile` passes (27 tests, including the new `status.test.ts`). `tsc` is clean apart from the existing errors in `extensions/obsidian-tracker`.
- **Live check:** to be covered by the next reconcile (`retire-the-ab-thread-registry`), which the supervisor starts after this merge.
