# Independent first use

## Predictions (before running either scenario)

- Idle release: after the thread yields with a managed watcher live, releasing its idle runtime should start another turn in the same thread without a new user prompt. The new turn should carry the watcher's outcome or say it was lost.
- Active Stop: after confirming a watcher is live and the turn is still running, stopping the turn should leave the thread without a watcher-triggered follow-up.

## Setup and actions

Tested `3abf244b` against real BB Pi threads in the `mlegls-pi` project using the existing signed-in provider, with a fresh worktree-owned `.wm/` workspace per scenario. No browser or servers. Run from the candidate checkout:

```sh
bun docs/attachments/released-pi-runtime-wakes-threads-with-live-watchers/first-use.ts release
bun docs/attachments/released-pi-runtime-wakes-threads-with-live-watchers/first-use.ts stop
```

Each command prints a thread ID and returns before the watcher is ready. Use `bb thread log <id> --all --json` to see the process start receipt and lifecycle events; `bb thread show <id>` confirms the current status. Once the watcher has started, run `bb thread stop <id>` at the appropriate boundary below. No follow-up prompts. Use the event log to count turn starts and inspect the second input, if any.

## Idle release — held

In @thread:thr_tzef4kxxt8 the process tool started `watcher-first-use` (`sleep 300`); the first turn replied `ready` and BB showed `idle`. The reported PID was still running immediately before I issued `bb thread stop`. BB accepted Stop and the watcher disappeared. The thread received a follow-up without a prompt from me: `"watcher-first-use" (proc_1): Stopped when the Pi runtime shut down. Resume the command explicitly if still needed.` The follow-up turn started (event 32) and replied `ack`. This exercises explicit idle release, the ticket's equivalent to the timed lease expiry.

Replay check: stop only after `ready` and while the watcher is live. Accept a second `turn/started` in the same thread without a manual tell; its input must identify the watcher and give its outcome or loss.

## Active Stop — held

In @thread:thr_hjq8sksxg4, the live log showed the managed watcher start and the process wait still running. I issued `bb thread stop` then. BB displayed `Stopped manually`; the log ended the first turn as `interrupted` (event 26). There was still just one request and one turn start at the observation cutoff, about 54 seconds after interruption (the idle-release follow-up in the paired run was already complete by then). Neither sleep was still running. Both disposable threads were archived after observation.

Replay check: stop while the process tool is waiting and the turn has yet to finish. Accept an interrupted turn and no second request or turn start during a minute of observation, including the time in which the paired idle release wakes.

## Interface observations

- The setup command's success means the thread was created. Readiness and the boundary at which to stop it are separate; the procedure above records how to establish both.
- The plain log displayed the automated loss notice under `User`, and the JSON classified the request as `source: tell`, `initiator: user`. The notice itself explains why the thread woke; the paired event log and absence of a manual tell establish which action caused the new turn.

