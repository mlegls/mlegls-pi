---
stage: done
assignee: agent
author: session:arkhai-payments
---

Two pi sessions ran one reconciler assignment in the same worktree at once and corrupted it. The case: `billing-portal-offers-non-card-methods-implement-1` in arkhai-payments, 2026-10-12 ~08:36–08:41 UTC. One was the zmx-launched worker (session `01a12f41-7df3-7167-af42-e8251445e282`, pid 73961). The other was its bb thread `thr_u8ursh8b9e` (session `01a12f41-8df3-73be-a4a0-ae49b92398d8`). Both published on `billing-portal-offers-non-card-methods/billing-portal-offers-non-card-methods-implement-1` (board `mv5034a3-qh6ph1`, `mv503kij-wiardi`, `mv505l0h-4ymhwp`). Their interleaved edits left `src/cash/top-up-methods.ts` exporting names other files didn't import, so `bun run check` failed. The child monitor reported pid 73961's exit at 08:41:27 with "last state working": it had kept taking turns for minutes after the bb thread existed.

Same day, the same move from the zmx process to a bb thread happened for every reconciler worker in arkhai-payments: `scm-local-payments-harness-implement-{9,b,d}`, `card-billing-portal-implement-6` and `card-billing-portal-drive-9`. Each time, the old process exited "idle", so nothing collided. Whatever moves the session into bb (`ab thread to-bb`, or the bb runtime launching workers under a bb parent: `ee15b483`, `d176c95e`, `b700dcc0`) evidently doesn't wait for, or stop, a source pi that is mid-turn or about to take its next turn. `to-bb` is documented as refusing a working thread, so either the guard misses a pi between turns that the reconciler nudges or mails, or the move isn't going through that path.

Also seen: once the bb thread was running, the reconciler re-delivered an already-answered `needs-input` as a new exception three times. It may be reading both sessions' posts on the worker topic.

Fix so that exactly one pi runs an assignment: the move stops the source before the bb thread takes a turn, and wake/nudge/mail paths never resume the source once the thread is in bb. Reproduce with a reconciler worker that receives a nudge during the move.

## Result

The second pi wasn't a move. Thread `fb993a33` was spawned straight into bb at 08:36:22 (registry record has `bb: thr_u8ursh8b9e`; no `to-bb`, no zmx terminal). Session `01a12f41-7df3` has no session file anywhere: it was bb's sessionless pi. Beside each thread's own pi (`--mode rpc --session …`), bb's provider bridge starts a `pi --mode rpc --no-session` in the thread's cwd. Both go through `BB_PI_BRIDGE_COMMAND` (`bin/bb-pi`), which sourced `.wm/launch.env` for every invocation. So the sessionless pi took the worker's identity: `PI_BOARD_TOPIC` gave its board host a wake subscription to the worker topic, and `PI_WM_PARENT_SESSION` made it a child of the reconciler's parent session. The real worker's `decision` posts and the reconciler's "no status" nudge woke it, and it worked the assignment as a second writer until bb ended it about five minutes later (08:41:27, mid-turn). The other arkhai-payments workers show the same pattern without a collision: for `scm-local-payments-harness-implement-d`, sessionless pid 41956 exited idle at 08:35:37 while pid 42151 is still the worker. Each of those workers had a second pi that happened to stay idle. The repeated `needs-input` exceptions were real posts by both sessions on one topic (08:38:45 from `8df3`, 08:38:58 from `7df3`), not a reconciler re-read.

Fix:
- `bin/bb-pi` sources `.wm/launch.env` only when pi is not started with `--no-session`.
- As a backstop, the board host never starts a turn in an rpc pi that has no session file. A sessionless pi in a worktree still joins that worktree's `wt/` and `ticket/` scope topics, and a wake there would have it run an unseen turn.

The `to-bb` and bb-wake paths were checked and need no change. `moveToBb` kills the zmx agent terminal and its runner, then SIGTERMs the source pi and waits for it to exit before `spawnBb`. bb-wake resumes a thread only when no live pi holds its session.

`lib/thread/bb-pi.test.ts` runs `bin/bb-pi` with a stub `pi` and asserts that the worker topic reaches the `--session` pi but not the `--no-session` one. It fails before the fix and passes after. `bun test` gives 215 passes; its 7 failures are in the system-prompt tests and also fail on the base. `tsc` reports the same 57 lines with and without the change. Live pis keep the environment they started with, so only pis that bb starts after this lands get the fix. No running worker was touched.
