---
stage: idea
author: session:b8c305ef-a0b0-41ad-9c26-1a43247c6129
---

A live pi process is not proof that its worker is progressing. Surface or recover an assistant turn ending with `stopReason: error` after a grace period, without treating a healthy long turn or normal idle after a report as dead.

Concept's root supervisor (`mail/2d15485e`) observed on 2026-10-01, on pre-0be483a reconcilers:
- fold-welcome drive-b ended on Codex `invalid base64 image_url` and idled for 7.5 hours. A bad screenshot remained in context, so simply mailing `continue` would repeat the error.
- export-…-implement-1 ended on WebSocket 1006 just after a checkpoint notice.

Current main's `lib/reconcile/reconcile.ts` uses thread terminal/pid liveness, not assistant stop reasons. [[projects/mlegls-pi/issues/archive/parent-waits-on-worker-that-died-without-a-report]] already implemented this signal for the deleted `lib/jobs` supervisor; reuse its design/evidence rather than inventing a new signal. Decide bounded recovery for transient errors versus relaunch or owner exception for persistent poisoned context. Both need the canonical thread → session join and grace based on the failed turn, not file mtime (board cursor writes can keep it moving).
