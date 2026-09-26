---
stage: idea
author: session:2026-09-26T09-29-46-063Z_01a0dd0c-9b4f-7795-aad1-0299963801cf
---

While fixing supervision closure ordering, inspection found a separate restart risk. `lib/children.ts:turnEndWm` calls `wm.attach(run, handle)` without the worker's checkout or parent repository. `wm.attach` defaults to `process.cwd()`; the shared daemon can supervise repositories other than its own startup directory. The poller queries workmux status by that cwd. A fresh Worker also has no paneId: `Worker.observe` does nothing when both the entry and known pane are absent, rather than emitting an exit. A restarted watch can therefore wait without a missing-worker event even if the worktree still exists. Board reports may hide the problem while workers are healthy.

This is code-path evidence, not a live reproduced daemon failure. Check actual workmux status scoping and reattach a stopped worker in another repository before changing the receipt/attachment API. Preserve the distinction between a missing worker and a temporarily unavailable host. Supervision now detects missing worktree paths and parks reported exits, but that does not cover an existing worktree whose pane cannot be rediscovered. Origin: [supervision closure review](close-a-supervised-ticket-inside-its-branch.md).
