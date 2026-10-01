---
stage: done
assignee: agent
priority: 2
part-of: "[[projects/mlegls-pi/issues/archive/supervise-loop-reliability]]"
author: session:01a0f324-32e8-732c-96ad-132d2d15485e
---

Superseded 2026-10-01 by [[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]]: `ab supervise` was deleted in the pi 0.99 rebuild (`4b79baa`). The reconciler relaunches a phase whose worker is gone (`relaunch` budget 2, then an exception).

Owner: `ab supervise`. When the tmux server died on 2026-10-01 at about 09:33 +0800, all eight Concept loops parked their workers as "unreachable" ("workmux target is not open") and woke the owner. The owner had to recover each one by hand: `workmux open <worktree>`, then `pi --continue` typed into the pane, then a "continue from worktree state" mail. `workmux open -c` failed with "No conversation found to continue" for every pi worker, because its resume doesn't find pi sessions. All eight resumed with their original mailboxes and continued.

Fix: when a worker's target is gone but its worktree and pi session file exist, the loop reopens it itself. It opens a target in the existing worktree, runs `pi --continue` there, and tells the worker that its host was lost and that commands in flight did not finish ([[projects/mlegls-pi/issues/tmux-server-loss-interrupts-an-in-flight-verification-command]]). The loop wakes the owner only when the reopen fails. Losing the whole host takes out every target at once, so reopening should go through [[projects/mlegls-pi/issues/admit-workers-against-a-host-wide-budget]] rather than relaunching all of them together.

2026-10-01 evidence: the manual reopen (`workmux open --parent-session …` then `pi --continue` typed into the pane) loses the worker's spawn environment (`PI_BOARD_TOPIC`, `PI_WM_RUN`, `PI_WM_HANDLE`; see `spawnEnv` in `lib/wm.ts`). The resumed workers finished and replied to the mailbox that steered them. Their turn ends never reached the `run/handle` topic that `waitForTurnEnd` watches, so eight loops stayed parked as unreachable and sent stale-wait reminders while their workers were done or still busy. A reopen has to relaunch with `spawnEnv`, or the loop has to also accept reports from the worktree's channel.
