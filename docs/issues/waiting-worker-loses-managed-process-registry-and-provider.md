---
stage: "done"
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

## Ticket (2026-11-09)

Recurred on 2026-11-07 for 5 Concept workers (efficiency audit @thread:thr_5aa27tkct7; one is @thread:thr_ghta4zwncx, whose managed process was "not found" after a 30-minute wait). Likely cause, to confirm first: bb may release an idle thread's pi ([dispatch.md](../dispatch.md)), and pi-processes keeps its registry in the pi process and its logs in a per-process `/tmp/pi-processes-*` directory, so a worker that yields `waiting` wakes in a fresh pi that knows none of its processes, while their children survive under parent 1 or die with the old pi.

Done when a worker that starts a managed process, yields `waiting`, and has its pi released and restarted by bb still finds that process (`process output`/`wait` by name) and its logs on wake, or, if the process died with the old pi, is told so with the retained log path rather than "No processes have been started in this session". A test reproduces the restart.

## Result

done — the fix is in pi-processes, not this repo, and the integration needs the pi-processes branch. The restart probe passes on my re-run. I read the pi-processes diff against the ticket and found no defects in it.

The pi-processes branch is `waiting-worker-process-recovery-implement`, now at `04a1ca0`. The checkout is `/home/mlegls/dev/pi-processes__worktrees/waiting-worker-process-recovery-implement`. My mlegls-pi commit `1fcea971` only appends the review to the driver's packet.

One repair: `cancels readiness when the process exits first` in `src/manager.test.ts` flaked on the baseline `da27921`, failing 3 of 8 runs. The end event follows real log I/O that fake timers don't await. I wrapped the assertion in `vi.waitFor` (pi-processes `04a1ca0`) and it then passed 12 of 12 runs. I filed no issues.

```yaml
commit: 1fcea971   # mlegls-pi review record; pi-processes fix at 876e860 + 04a1ca0 (branch waiting-worker-process-recovery-implement)
stories:
  - story: Recover a managed process after Pi restart, or explain its death with retained logs
    outcome: held
  - story: A regression probe reproduces the restart
    outcome: held
evidence:
  path: docs/attachments/waiting-worker-loses-managed-process-registry-and-provider/drive-2/index.md
  visual: false
  shots: []
tests:
  - src/restart.integration.test.ts   # pi-processes
  - src/manager.test.ts               # pi-processes; assertion wrapped in vi.waitFor
fixed:
  - "pi-processes 04a1ca0: flaky readiness-cancel test (~3/8 failures on baseline, 0/12 after)"
filed: []
caveats:
  - "Changed a kept test's assertion: manager.test.ts 'cancels readiness when the process exits first' now awaits the event with vi.waitFor. Same expectations, only the timing differs."
  - "The fix lands in pi-processes. The parent must integrate that branch; landing this mlegls-pi branch does not land it."
  - "Managed processes are stopped when Pi shuts down. After a restart, `output` and `wait` report 'interrupted' and name the retained logs. A live child is not kept running."
  - "BB's real half-hour idle eviction was not exercised, only the local RPC release/restart probe."
  - "Each state change writes a small registry.json beside the session file (atomic rename, synchronous). I didn't measure the cost."
  - "A corrupt registry.json would throw in restoreSession during session_start. Writes are atomic, so this is unlikely."
```

Installed 2026-11-12 by the efficiency audit (@thread:thr_879y94y97m): the ticket closed with `876e860` and `04a1ca0` still only on pi-processes branch `waiting-worker-process-recovery-implement`, so the configured `~/dev/pi-processes` (`local-integration` at `da27921`) never ran them. Merged there at `ad8a5e3`; its 279 tests and typecheck pass. Pis pick it up on restart.

Evidence: [docs/attachments/waiting-worker-loses-managed-process-registry-and-provider/drive-2/index.md](../attachments/waiting-worker-loses-managed-process-registry-and-provider/drive-2/index.md)
