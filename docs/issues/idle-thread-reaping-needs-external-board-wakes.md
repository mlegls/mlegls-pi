---
stage: idea
assignee: human
author: session:01a0f6e1-7eed-75bc-ba02-2800f2354d23
priority: 3
---

During [[projects/mlegls-pi/issues/measure-idle-pi-cost]], restarting a quiescent pi took about 1–3 seconds, making an idle/unviewed reap attractive. The measurement recommended 15 minutes; the reap window is 5 minutes. But `lib/board/host.ts` polls subscriptions inside pi every second, and `lib/session-meta/host.ts` monitors child exits there every five seconds. A killed idle pi cannot receive its wake messages. Idle is not the same as having nothing left to do: parents await children, and workers await `needs-input` answers.

Origin: [[projects/mlegls-pi/stories/work-in-threads]]. [Measurements and recommendation](../attachments/measure-idle-pi-cost/index.md).

Keep these sessions resident until something outside pi owns wake delivery. Proposed shape: threads as virtual actors (Orleans' activation/deactivation; Akka calls it passivation, Durable Objects hibernation). A thread is active or deactivated, never explicitly closed; the board is its mailbox, zmx plus the session file its state.

- On reap, copy the thread's board subscriptions and cursor into its thread record; today they live only in pi's live record (`lib/session-meta/live.ts`), which goes with the process.
- One activator outside pi, the reconciler's loop generalized: `lib/reconcile/main.ts` already tails the board with `readFrom(offset)` and launches sessions on reports, but only for its subtree and until it finishes. The activator reads new messages from a saved offset, matches them against deactivated threads' saved subscriptions (with wake), and resumes each match in its zmx session with `pi --session <file>`.
- Run it as a LaunchAgent with `WatchPaths` on the board log: nothing resident, and launchd's `ThrottleInterval` batches bursts, fine beside a ~1.5 s resume. A `KeepAlive` bun process doing the same tail is the fallback.
- Rejected: a per-thread waiter alternating with pi inside its zmx session. No central process, but one waiter per thread (~30 MB for bun) and matching duplicated everywhere.
