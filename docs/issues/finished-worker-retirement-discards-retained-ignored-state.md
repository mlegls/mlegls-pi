---
stage: "ticket"
assignee: "agent"
priority: 1
author: "session:thr_a35xhciju2"
---
Observed 2026-10-25 on the concept Beelink checkout: compare-tutor-models-on-material-quality-and-completeness-implement-3 ran an authorized paid Luna Lesson. It reported done and documented its retained state in the handoff: the deployment under packages/web/.convex/local/, and a private Convex export plus ledgers under .captures/material-model-comparison/ ("Preserve this worktree or that entire capture directory before retirement"). When the phase moved on to drive, the reconciler retired it through retireHandle(h, into, finished=true), which passes discardIgnored: true to retire. Every ignored path went with the worktree. Nothing reached __retired, the reconciler log has no "retired … keeping" line, and the owner got no notice. The drive then could not reopen the Session, so the paid draw is now readable only through its committed JSON.

The doc comment says "the worker reported done and its work was taken, so its ignored state is discarded". That holds for code changes. It doesn't hold for evidence and stateful work, where the ignored state is the deliverable a later phase opens.

Want: retirement never discards ignored state that isn't declared disposable (wm.disposable or the built-in DISPOSABLE lists), whether or not the worker finished. A finished worker's kept state gets the same RETIRED.md, log line and owner notice as an unfinished one.

Acceptance: a test where a worker that reported done is retired holding an undeclared .captures/x and packages/web/.convex/. Both end up under __retired with RETIRED.md, and the owner is told.
