---
stage: idea
author: session:01a0f362-3628-714a-a0cd-cce4046b272e
---

During Concept's [[projects/concept/attachments/repair-checks-left-red-on-main/index|repair-checks drive]], the host reported “tmux server died” and resumed the worker with `pi --continue`. The previously running full `bun test` had no terminal summary: its saved log stopped at the last file, after official publication in `mission-allowance.test.ts`. The original bash PID was absent on recovery. The first evidence commit had completed and survived.

Owning boundary: mlegls-pi's worker hosting / tmux lifecycle; cause unestablished. This is a reported host teardown plus an interrupted command, not evidence that Bun or the product failed. The drive services had already been stopped deliberately before this command.

Workaround: recover from committed worktree state, treat the partial run as interrupted rather than green, and rerun the same full command. It completed with 557 passed, 13 skipped, zero failed in 324.80s. Investigate why the tmux server died and whether interrupted tool handles can retain a terminal reason across `--continue`; no hosting changes attempted.

whole host, 2026-10-01: at about 09:33 +0800 the default tmux server died with every Concept worker in it. All eight supervise loops parked their workers as unreachable at once. In the hour before, swap had gone from 9 to 13 GB and load reached ~15 on 14 cores, so memory pressure is the likely cause, though it isn't established. The reconciler now relaunches a phase whose worker is gone ([[projects/mlegls-pi/issues/archive/supervise-reopens-workers-lost-with-their-host]]); the budget is [[projects/mlegls-pi/issues/admit-workers-against-a-host-wide-budget]].
