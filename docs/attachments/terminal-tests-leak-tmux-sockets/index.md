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
