---
stage: "idea"
assignee: "agent"
author: "session:seed-completed-mission-intermittently-refuses-session-moved-on-implement-1"
priority: 3
---
During [[projects/concept/issues/seed-completed-mission-intermittently-refuses-session-moved-on]], worker `seed-completed-mission-intermittently-refuses-session-moved-on-implement-1` yielded plain `waiting` on managed `seed-reproduce-baseline` (PID 940961), with a local Convex/Vite stack and scripted provider also managed. The first half-hour wake recovered live output with `process output`; the next half-hour wake returned `Process not found: seed-reproduce-baseline. No processes have been started in this session.` The worker had not checkpointed. Previously named `/tmp/pi-processes-mRzYOf/proc_5-stdout.log` was also absent. The backend and Vite survived under parent 1, but the provider was gone. Worktree-owned output preserved sixteen passing seeds and run 17's provider ConnectionRefused failure. No original seed assertion failure was established.

Owner: pi-processes / BB Pi session lifecycle. This differs from the historical checkpoint-only case in [[projects/mlegls-pi/issues/reconciler-drive-continuation-loses-managed-process-ownership]]: both preceding worker reports were ordinary `waiting`.

Workaround: keep subprocess output in checkout-owned files, inspect exact command/cwd ownership of survivors, stop the owned local stack with its checkout stop task, restart the provider and stack, and recheck readiness. A newly registered recovery seed correctly refused the surviving target because the ready marker no longer had a live owner. No cause for the registry reset, deleted logs or provider exit is established. Source thread: worker of `seed-completed-mission-intermittently-refuses-session-moved-on` on 2026-11-03 (host local time); retained seed logs are in the Concept worker's `docs/attachments/seed-completed-mission-race/`.
