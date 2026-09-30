---
stage: ticket
assignee: agent
priority: 2
part-of: "[[projects/mlegls-pi/issues/supervise-loop-reliability]]"
blocked-by: ["[[projects/mlegls-pi/issues/parent-waits-on-worker-that-died-without-a-report]]"]
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

On 2026-09-30 a tend session started 15 `ab supervise start` jobs back to back. One (`ab-jg-can-stall-without-output-during-semantic-discovery`) woke its owner with `worker did not start within 30s (no pi session found)`, although its worktree and tmux window existed; `resume … redispatch` then started it normally. The 30s start deadline from [[projects/mlegls-pi/issues/archive/supervise-detects-unstarted-workers]] looks too tight when many workers launch at once. Options: scale the deadline with concurrent launches, or check the window/pane before calling the worker unstarted.

second case, 2026-09-30: `orchestration-audits` was launched alone (no burst) at about 05:21:55 and got the same wake at 05:22:44, while its pane showed the worker thinking through its first turn (zai glm-5.3-flash, high). Its session directory existed from 05:22:15 but held no `.jsonl` yet: pi writes the session file only after the first assistant message completes, and `hasPiSession` (lib/jobs/supervise.ts) lists `.jsonl` sessions, so any first message longer than the grace period reads as "not started". Burst load only makes that likelier. A startup check that doesn't depend on pi's lazy flush (the pane's process, or the session directory pi creates at start) would fix both cases.

raised to p2, 2026-09-30: it fired for 3 of 3 glm-5.3-flash implementers in one orchestration-audits campaign (orchestration-audits, cache-read-fence-knee, orchestrate-rework-effect), each thinking through a long first turn. Every false alarm costs an owner wake.

ticket contract, 2026-09-30: the start check no longer calls a worker unstarted just because pi hasn't written its session `.jsonl` yet (pi writes it only after the first assistant message completes). Use a signal that tracks the worker, such as the pane's pi process or pi's session directory, and share the liveness reading with the dead-worker detection. First use: a slow first turn (glm-5.3-flash, or several launches at once) doesn't false-alarm, and a worker that really failed to start still does.
