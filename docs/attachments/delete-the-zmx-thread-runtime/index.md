# bb-only runtime encounter

Revision: cef2abb8e80151d71a5ddd6174276824aaf8438d. CLI-only, no rendered UI.

## Setup and predictions (before first dispatch)

Owned target: this drive-2 worktree; bb daemon shared host service, worker target will be a newly dispatched child worktree. Persona: local developer using existing bb login; no seed or credentials required. Setup completed per parent notification. `bb status` responds and identifies this thread thr_cxc9n3aw4e and parent thr_yfrbqyxd3b.

Predictions from ticket and docs:
- Dispatch a trivial fill worker at the tested revision: receipt names an owned worktree and bb shows a child thread. Worker reports completion; integration merges its committed artifact and retires its thread/worktree.
- From a plain terminal with BB variables unset, thread launch still uses bb and creates a top-level thread.
- An unreachable daemon yields one start-bb error and no worktree. Do not stop the shared daemon to provoke this.
- Non-pi command launch is rejected clearly.
- Legacy zmx registrations can be listed without migration; no legacy registration is supplied.
- Runtime selection/admission removal and typecheck/test acceptance are source/test-review claims, not observable from this user's journey.

## Encounter

1. `tools.dispatch` launched fill worker `bb-runtime-drive-2/smoke` at the tested revision, receipt thread 74d1a21a-4f94-4062-bee9-3c9b9ef2d568. `bb thread list --parent-thread thr_cxc9n3aw4e --json` showed bb thread thr_r2bnsyxq3j, provider pi, exact owned `/Users/mlegls/dev/mlegls-pi__worktrees/smoke` target. Prediction met.
2. Worker reported done through board with commit 01810aea044c66a6f03213553614557597a0e6c1. Integrated via `tools.integrate` using the receipt: rebase succeeded, thread closed, worktree removed, branch deleted; two owned leftover processes terminated. [Merged artifact](smoke.md) contains the requested sentence. Prediction met.
3. Started `./bin/ab thread new --worktree bb-plain-drive-2 --base cef2abb8e80151d71a5ddd6174276824aaf8438d --prompt <immediate completion>` through Python execve with every BB_* environment key omitted. Spawn succeeded. bb listed thr_7gbrx6pydw at that exact owned target, idle, parentThreadId null. Prediction met. Abandoned registration 4a86f330-91ad-4b49-9517-94823a5203ba afterwards: thread closed, two owned processes terminated, branch/worktree removed.
4. `./bin/ab thread new --cmd 'echo unsupported'` exited 1 with `Unknown option '--cmd'`, before any launch. Dropped command surface held; a bb-specific explanatory error was not offered. Direct library launch.cmd and wm --command were not exposed by the supplied entry point (`wm` is not on PATH).
5. `./bin/ab thread ls --json` succeeded with 22 registrations, including two without bb fields (cbe0f628-1629-44a1-b1c6-a113a50427ae and a714e693-ad49-464c-837c-581525e4add4), both exited. Legacy-list prediction met; existing registrations were not modified.
6. Daemon-down behavior remains unobservable: the handoff supplies a reachable shared daemon, not an owned stoppable one or an endpoint override. Did not stop shared service. Source deletion, admission removal, setup dependency removal and typecheck/test gates belong to reviewer/integration, not this black-box drive.

## Frictions and replayable checks

- Loaded tool descriptions still say zmx / host memory admission; bare `ab` on PATH advertises removed `to-bb` and `--cmd`, unlike checkout-local `./bin/ab`. This makes a successful smoke ambiguous about revision identity. Existing owner updated immediately: [drive-pi-extensions-from-reviewed-worktree](../../issues/drive-pi-extensions-from-reviewed-worktree.md). Workaround: checkout-local CLI; handed-off dispatch/integrate tools used as requested, exact loaded code not established. README and docs/dispatch describe bb as expected.
- Check: repeat dispatch at an exact base, list bb children scoped to caller, require pi provider and receipt-matching environmentPath; await board done, integrate, require artifact and thread/worktree cleanup.
- Check: unset all BB_* keys, run checkout-local thread new into a fresh owned worktree, require bb listing with parentThreadId null, then abandon only that registration.
- Check: provide a worker-owned unavailable daemon endpoint before launch; require one actionable start-bb error and absence of requested worktree. Still needs an authorized isolation recipe.
- Check: invoke unsupported non-pi option through supported public entry; require nonzero error before worktree creation.
- Check: list existing registrations, require old non-bb entries are exited or clearly reported, not a whole-list failure.

## Outcome and limits

Dispatch/integrate and plain-terminal bb launch held, as did legacy listing and dropped CLI command option. Daemon-down and direct launch.cmd rejection were not observed. No rendered UI, screenshots, servers or browser pages. All child resources created by this encounter were retired; shared daemon left untouched.

## Review (appended; the driver's record above is unchanged)

Revision reviewed: f3faba83 plus the repairs below. Source review against the ticket, the supervisor's ruling and the diff since 1421862a.

Repairs:
- **Setup regression** (commit "Worker setup keeps the conflict-marker skip and network retry"). The rewritten `pendingSetup` in lib/thread/setup.ts had dropped three behaviors of the deleted agent-runner: a worker handed a pending merge skips setup (the reconciler's refresh prompt promises this; without it the spawn would fail on conflict markers), a worker's setup retries transient network failures twice, and an interactive thread's setup runs beside its pi instead of before it. Restored, with the worker's launch env.
- **Deleted tests restored on a fake bb CLI** (supervisor ruling 1). lib/thread/fake-bb.ts is a script on `BB_CLI` that answers project, thread spawn/list/stop/archive/tell/log/wait/open, keeps each bb thread as a file under `FAKE_BB_DIR` and logs calls. Restored: lib/reconcile/refresh.test.ts (both tests; the first never touched zmx), constraints.test.ts, stop.test.ts (fixture in the stopped-supervise attachment), retry.test.ts (fixture rewritten: the setup half now calls `pendingSetup` with a fake mise, the provider half runs the reconciler on fake bb threads; the fake thread goes idle when pi ends its turn on an error, as bb's would), lib/thread/lifecycle.test.ts, runtime.test.ts (owner/guest setup, bare-handle ambiguity, collector base; zmx terminal-ensure and history assertions became fake-bb `tell`/`log`), cli.test.ts (row formatter only; the fork test's subject is gone), lib/wm.local.test.ts (still opt-in with PI_TEST_LOCAL_WM=1). Stay deleted: admission.test.ts and agent-runner (host admission is gone).
- Unused imports left by the deletion removed (lib/wm.ts, lib/thread/cli.ts).

Stories the driver could not observe, now observed:
- **Unreachable daemon fails before worktree creation: held.** `BB_CLI=/usr/bin/false ./bin/ab thread new --worktree probe-wt` in a fresh repo printed one line (`bb is not running: start the bb app …`); no `__worktrees` directory, no branch, `git worktree list` unchanged.
- **Direct launch.cmd rejection: held.** `newThread({ launch: { cmd: "echo hi" } })` throws `Threads run pi in bb; a launch command is not supported`. `wm.spawn({ command })` throws its own unsupported-command error (lib/wm.ts).

Supervisor ruling 3 (extensions/workspace): kept. `index.ts`/`move.ts` serve /workspace in any pi, plain terminal sessions included (under bb the command refuses and points at update_environment_directory); the `session_start` handler in thread.ts keeps the registry on the session pi continues in, whichever process hosts the pi. The restart-on-quit sentence was the zmx runner's and is already gone from the README.

Measured: the restored suites on fake bb add roughly 100 s of wall time to `bun test` (full suite 142 s, 222 pass, 0 fail, 2 skip); retry.test.ts is 43 s of that, 15 s of it the real network-retry backoff.
