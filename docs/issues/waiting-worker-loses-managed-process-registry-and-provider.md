---
stage: "idea"
assignee: "agent"
author: "session:seed-completed-mission-intermittently-refuses-session-moved-on-implement-1"
priority: 2
---
During [[projects/concept/issues/seed-completed-mission-intermittently-refuses-session-moved-on]], worker `seed-completed-mission-intermittently-refuses-session-moved-on-implement-1` yielded plain `waiting` on managed `seed-reproduce-baseline` (PID 940961), with a local Convex/Vite stack and scripted provider also managed. The first half-hour wake recovered live output with `process output`; the next half-hour wake returned `Process not found: seed-reproduce-baseline. No processes have been started in this session.` The worker had not checkpointed. Previously named `/tmp/pi-processes-mRzYOf/proc_5-stdout.log` was also absent. The backend and Vite survived under parent 1, but the provider was gone. Worktree-owned output preserved sixteen passing seeds and run 17's provider ConnectionRefused failure. No original seed assertion failure was established.

Owner: pi-processes / BB Pi session lifecycle. This differs from the historical checkpoint-only case in [[projects/mlegls-pi/issues/reconciler-drive-continuation-loses-managed-process-ownership]]: both preceding worker reports were ordinary `waiting`.

Workaround: keep subprocess output in checkout-owned files, inspect exact command/cwd ownership of survivors, stop the owned local stack with its checkout stop task, restart the provider and stack, and recheck readiness. A newly registered recovery seed correctly refused the surviving target because the ready marker no longer had a live owner. No cause for the registry reset, deleted logs or provider exit is established. Source thread: worker of `seed-completed-mission-intermittently-refuses-session-moved-on` on 2026-11-03 (host local time); retained seed logs are in the Concept worker's `docs/attachments/seed-completed-mission-race/`.

Independent recurrence 2026-11-07: Concept busy-host drive-9 yielded ordinary `waiting` for `drive-busy-seeds` (PID 2384891), backend and scripted provider. After the supervisor's 30-minute wake, `process output` returned the same empty-registry error. Durable `/tmp/seed-mission-busy-drive-9` retained eight full exit-0 seeds; seed 9 had only its readiness line, no exit metadata or final summary. Runner, eight exact recorded load PIDs, backend launcher and provider PIDs were all absent on exact-PID inspection. `mise run local:stop` removed two checkout-owned remaining processes. This interrupted independent verification, not an original seed assertion. Packet: [[projects/concept/attachments/seed-mission-busy/drive]]. No lifecycle cause established; did not blindly repeat the long encounter.

## Concept recurrences, 2026-11-07 (moved from Concept's tracker)

Five more Concept workers met the same empty registry on the turn after a long idle wait, each with its `/tmp/pi-processes-*` directory gone and the managed PID dead, while detached Convex/Vite descendants survived:

- production-copy verification: proc_1/PID 3177174 after the parent's 30-minute wake; recovered from the CLI's durable receipt. [[projects/concept/attachments/prove-initial-theory-baselines-on-production-copy/drive/index]]
- large-card-imports reference drive B: proc_4/PID 3009010 (`drive-b-matrix`) lost mid-matrix; the final 5000-card row's count is unrecoverable. [[projects/concept/attachments/make-large-card-imports-scale-in-one-tutor-script/drive-b]]
- review pagination (@thread:thr_ghta4zwncx): proc_12/PID 3008417 (`review-5000-encounter-3`) lost after 2000 cards, 30 minutes later; the recipe now checkpoints every 500 cards.
- bounded SRS completion (@thread:thr_i7rds8s9f2), 21:40 +08:00: proc_31 (`large-completion-rebased-recall`); resumed with the recipe's `--resume`. [[projects/concept/attachments/maintain-bounded-srs-completion-inputs/index]]
- review completion facts first use (@thread:thr_57cnxtdxra): after a compaction and parent resume, proc_2 was gone, the watcher PID dead and its backend reparented; readiness then timed out on a stale push until the worker stopped the exact PIDs and restarted. [[projects/concept/attachments/review-completion-first-use/index]]

Counter-observation, 22:14 +08:00 (@thread:thr_35dufwsp46): the parent's recovery message said no managed process was running, yet `process wait` on proc_9/PID 2890815 returned running twice with advancing output; nothing was lost.

Every loss follows a turn boundary after a long idle wait (about 30 minutes) or a compaction/resume, and the losses look like a pi restart: the in-memory registry is empty, the session's temp log directory is deleted and group members are killed, while detached descendants survive. Untested hypothesis: bb's Pi provider replaces the idle pi process between turns and pi-processes' shutdown cleanup runs. Workaround in all cases: durable checkout-owned output and resumable recipes; the impact is lost long-run evidence and repeated multi-minute encounters.
