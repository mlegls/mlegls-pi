---
stage: idea
assignee: agent
author: session:arkhai-payments
---

Two pi sessions ran one reconciler assignment in the same worktree at once and corrupted it. The case: `billing-portal-offers-non-card-methods-implement-1` in arkhai-payments, 2026-10-12 ~08:36–08:41 UTC. One was the zmx-launched worker (session `01a12f41-7df3-7167-af42-e8251445e282`, pid 73961). The other was its bb thread `thr_u8ursh8b9e` (session `01a12f41-8df3-73be-a4a0-ae49b92398d8`). Both published on `billing-portal-offers-non-card-methods/billing-portal-offers-non-card-methods-implement-1` (board `mv5034a3-qh6ph1`, `mv503kij-wiardi`, `mv505l0h-4ymhwp`). Their interleaved edits left `src/cash/top-up-methods.ts` exporting names other files didn't import, so `bun run check` failed. The child monitor reported pid 73961's exit at 08:41:27 with "last state working": it had kept taking turns for minutes after the bb thread existed.

Same day, the same move from the zmx process to a bb thread happened for every reconciler worker in arkhai-payments: `scm-local-payments-harness-implement-{9,b,d}`, `card-billing-portal-implement-6` and `card-billing-portal-drive-9`. Each time, the old process exited "idle", so nothing collided. Whatever moves the session into bb (`ab thread to-bb`, or the bb runtime launching workers under a bb parent: `ee15b483`, `d176c95e`, `b700dcc0`) evidently doesn't wait for, or stop, a source pi that is mid-turn or about to take its next turn. `to-bb` is documented as refusing a working thread, so either the guard misses a pi between turns that the reconciler nudges or mails, or the move isn't going through that path.

Also seen: once the bb thread was running, the reconciler re-delivered an already-answered `needs-input` as a new exception three times. It may be reading both sessions' posts on the worker topic.

Fix so that exactly one pi runs an assignment: the move stops the source before the bb thread takes a turn, and wake/nudge/mail paths never resume the source once the thread is in bb. Reproduce with a reconciler worker that receives a nudge during the move.
