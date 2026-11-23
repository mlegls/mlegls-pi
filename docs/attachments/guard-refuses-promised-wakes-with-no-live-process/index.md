# Promised wake: first-use replay

Tested revision: `bb64cdfa`. Surface: disposable Pi SDK sessions launched from this checkout, with a scripted model stream and no credentials.

## Predictions before first use

1. In `empty` mode, Pi receives a final message promising to act when something finishes. With no live managed process, I expect one refusal with the ticket's warning and instructions to use `process wait` or an automation.
2. In the same turn, the next final message can end the turn; I expect no second refusal even if it repeats the promise.
3. In `live` mode, I expect the same promise to end the turn without a refusal while a real managed process is running.

## Replay and observations

```sh
replay=docs/attachments/guard-refuses-promised-wakes-with-no-live-process/replay.ts
bun "$replay" empty && bun "$replay" live
```

The replay requires Bun, the installed repository dependencies, and `~/dev/pi-processes` with its dependencies installed. Both modes announced readiness in fresh Pi sessions and the command exited successfully in 5 seconds.

| Check | Observed | Prediction |
|---|---|---|
| Run `empty`; expect the first attempt to end on a promise to be refused. | After readiness with no process, Pi emitted: “Nothing is running that will wake this thread. Wait in the foreground with process wait, or hand the wait to an automation.” | Met |
| In `empty`, let the scripted model repeat the promise; expect turn completion without another warning. | The replay reported the repeated promise accepted on the second turn end. | Met |
| Run `live`; expect the same text to complete without a warning with a real managed watcher. | After readiness with the process extension, the replay reported the same promise accepted with a live watcher. | Met |

No friction encountered. The replay exercises Pi's turn-end behavior through the SDK with scripted text; it does not exercise model wording choices or delivery of a later watcher notification.

## Review

The guard refused when Pi had no session file (`--no-session`, in-memory sessions). pi-processes keeps no receipt then, yet still runs processes, so a live watcher could not be seen and the promise was refused anyway. The guard now treats that case as unknown and lets the turn end; a missing registry beside a real session file still counts as empty. Reran `bun "$replay" empty && bun "$replay" live` on the repaired head: same three outcomes as above. `bun test extensions/guard lib/reconcile`: 69 pass.
