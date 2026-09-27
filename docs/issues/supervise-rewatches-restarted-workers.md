---
stage: ticket
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
---

Once a child is marked `unreachable` (its worker exited), the supervise loop stops watching it (`watched = live.filter(c => !c.unreachable)` in `lib/jobs/supervise.ts`). The wake message still says "Steer it directly (its next turn end returns to the loop)", which isn't true then. On 2026-09-27 `dsh-scratch-state` was restarted with `pi -c` after a board-poller crash, finished, and posted `done` at 09:35. The loop kept it at `waiting: unreachable` until the owner queued `resume … verify` by hand.

Done when a restarted worker's next report on its topic returns an unreachable child to the loop, as the message promises. Its worktree has to exist, and the loop must not spin or re-wake while the worker stays dead (`children.turnEnd` returns `unreachable` immediately for a dead worker). If that can't be done cleanly, the unreachable wake should instead say to restart the worker and then `resume`.
