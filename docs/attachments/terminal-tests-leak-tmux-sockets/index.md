# Terminal test socket cleanup — first-use drive

Revision: `71fece2cc4675283e914df4a18f8fda9fd6cde6d`.
Surface: the documented Bun test CLI, not a rendered UI. No source, diffs,
test bodies or fixtures were inspected.

## Predictions (written before setup and first test run)

1. **Teardown:** running the terminal tests should exit successfully, stop the
   servers they start with tmux `-L`, and leave no new sockets in their test
   prefixes. I expect a second run not to grow the socket directory.
2. **Startup sweep:** a socket left by a killed server whose name starts with
   `pi-terminal-test-` or `pi-terminal-` should disappear when the suite starts.
   I expect a live server with the same prefix and a stale socket with an
   unrelated prefix to survive. This follows the ticket's "stale" and "their
   own prefix" boundaries.

## Setup plan and ownership

The implementer's setup handoff was `null` (no prepared target or entry point).
The root README documents `bun run setup`, then `bun test`; `.workmux.yaml`
runs setup on worker creation. I will finish setup explicitly and run the
session suite via `bun-axi test lib/session`, an existing CLI surface.

Deployment: local CLI in this worktree. Persona/auth: local developer account;
no app authentication. Target: a new worker-owned temporary directory selected
with `TMUX_TMPDIR`, with `TMUX` unset; no shared `/private/tmp/tmux-501` sockets
will be seeded, killed or removed. Seed: two stale test-prefix sockets, one
live test-prefix sentinel, and one unrelated stale sentinel, all created here.
Readiness requires completed setup and an observed working isolated tmux server.

## Session log

- Setup completed with Bun 1.4.2 and tmux 3.7b; `bun-axi run setup`
  reported success in 177 ms ([setup output](setup.log)).
- Allocated `/tmp/pi-socket-drive.kDkpvW` (tmux reports its canonical path as
  `/private/tmp/pi-socket-drive.kDkpvW/tmux-501`). Created four owned servers
  using `tmux -f /dev/null -L <label> new-session -d -s drive 'sleep 600'`.
  Used `display-message -p '#{pid}'` before sending SIGKILL to the three stale
  seeds. The socket directory contained all four sockets, and the live sentinel
  answered `has-session` successfully ([before state](before.log)).
- Launched `env -u TMUX TMUX_TMPDIR=/tmp/pi-socket-drive.kDkpvW ab check --
  bun-axi test lib/session`. Admission reported a queued check; a subsequent
  observation still showed all four seeds and the live sentinel responding
  ([during observation](during.log)). This observation alone does not establish
  that suite startup had occurred.
- First run finished with **24 passed, 1 failed across 5 files** in 12.0 s.
  The CLI reported `TmuxTerminalManager > waits for output to change from a
  previous cursor`, `expect(received).not.toBe(expected) Expected: not true`
  ([summary](run-1-summary.log), [full CLI output](run-1.log)).
- After that failed run, only `drive-unrelated-stale` and
  `pi-terminal-test-drive-live` remained in the owned directory. Both stale
  test-prefix seeds were gone; no additional test sockets remained. The live
  sentinel still reported its original PID, 56675 ([after first run](after-1.log)).
  Thus cleanup also ran when a test failed.
- Started an unchanged second run of the same CLI command to distinguish a
  persistent regression from an intermittent failure and to check socket growth.
- The unchanged second run reported **all 25 passed across 5 files** in 4.9 s
  ([summary](run-2-summary.log), [full CLI output](run-2.log)). The filter also
  selected three `lib/session-meta` files; the terminal files remained the
  `lib/session/tmux.test.ts` and `lib/session/alerts.test.ts` surfaces.
- The same two sentinels remained after the second run; the original live PID
  still responded. The only remaining `pi-terminal-test-` tmux process was that
  owned live sentinel ([after second run](after-2.log)). Other visible
  `pi-terminal-` servers predated this drive by days; none were manipulated.
- Stopped the owned sentinel by its exact `-L` label, removed the allocated
  temporary directory, and observed PID 56675 gone ([cleanup](cleanup.log)).
  No dev servers or browsers were started.

## Story outcomes and expectations

| Claim / prediction | Outcome | Observation |
| --- | --- | --- |
| Test teardown stops owned servers and removes their sockets | held | No new test socket remained after either run; only the deliberate live sentinel had a remaining test-prefix tmux process. |
| Startup sweeps stale sockets in test prefixes | held | Both SIGKILL-created stale test-prefix sockets disappeared. |
| Preserve live test-prefix and unrelated stale sockets | met | Original live PID and unrelated stale socket survived both runs. |
| Test CLI succeeds on first use | not met | One output-cursor wait failed on the first run; the unchanged rerun passed all 25. |
| Repeated runs do not grow the socket directory | met | The same two sentinels remained after each run. |
| Setup handoff provides a runnable target | not met | Handoff was null; the README and explicit successful setup supplied a usable CLI entry point. |

## Frictions

- No prepared setup was supplied; the README resolved this without requiring a
  parent intervention.
- The `lib/session` Bun filter also selected `lib/session-meta` tests. This is
  observable CLI substring matching, not a socket-cleanup failure.
- An output-cursor wait failed once and passed unchanged on rerun. Its cause
  remains unknown; recorded under
  [terminal-output-cursor-wait-can-report-unchanged](../../issues/terminal-output-cursor-wait-can-report-unchanged.md).

The drive measures normal suite completion, including a test assertion failure;
it does not measure abrupt termination of the Bun runner itself. No product
changes or permanent acceptance tests were written.

## Replayable checks

These describe CLI observations for a reviewer, not newly written tests.

1. Allocate a fresh `mktemp -d /tmp/pi-socket-drive.XXXXXX` directory. For each
   label `pi-terminal-test-drive-stale`, `pi-terminal-drive-stale`,
   `drive-unrelated-stale`, `pi-terminal-test-drive-live`, run
   `env -u TMUX TMUX_TMPDIR="$root" tmux -f /dev/null -L "$label" new-session
   -d -s drive 'sleep 600'`. Record `display-message -p '#{pid}'`; SIGKILL only
   the first three owned server PIDs. Accept the starting state only when four
   socket files exist and the fourth server answers `has-session -t drive`.
2. Run `env -u TMUX TMUX_TMPDIR="$root" ab check -- bun-axi test lib/session`
   to completion. Accept startup sweeping only when the two stale test-prefix
   sockets are absent, the unrelated stale socket remains, and the original
   live sentinel PID still responds. Accept teardown socket cleanup only when
   no newly created test socket remains, including after a failing test run.
3. Run that exact command again without changing the starting sentinels.
   Accept repeatability when it succeeds and the same two sockets remain.
   Preserve failure summaries if the output-cursor wait fails again; success
   on rerun establishes intermittency, not its cause.
4. Kill the live sentinel with its exact `-L` label, remove only this allocated
   directory, and verify its recorded PID no longer exists. Never clean the
   shared system tmux socket directory as part of this drive.
