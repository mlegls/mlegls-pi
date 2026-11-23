# A live watcher promise across BB runtime release

Tested `3c0d8421`: the guard and the release hook loaded together in real BB Pi thread @thread:thr_rt39v4kdbm (`env_jir73ip3bp`, ready). The fixture uses the signed-in Pi provider and an empty workspace it creates under this checkout's `.wm/`. The only work started is `sleep 300`; publishing is simulated.

## Try it

From the candidate checkout after `mise run setup`, use a local BB project with an authenticated Pi provider. `BB_PROJECT_ID` selects the project for this checkout; `BB_WAKE_MODEL` can override the model, and `BB_THREAD_ID`, when present, owns the disposable thread's lifecycle.

```sh
fixture=docs/attachments/released-pi-runtime-wakes-threads-with-live-watchers/first-use.ts
bun "$fixture" promise
```

Use the printed `id` and `root`. In `bb thread show "$id" --json`, wait for environment `ready` and thread `idle`. In `bb thread log "$id" --all`, look for the exact final reply, “When the watcher finishes, I'll publish.” The `session_start` entry in `$root/runtime.jsonl` gives the Pi session file. Its sibling `<file>.processes/registry.json` should show `watcher-first-use` as `running`; the session JSONL should have no `promised-wake` message.

Run `bb thread stop "$id"` while the thread is idle and the watcher is live. This is BB's idle-release equivalent. Without sending another prompt, check `bb thread log "$id" --all` for a notice naming the watcher and its outcome, followed by `ack`. Then run `bun "$fixture" clean "$root"` to stop and archive the disposable thread and remove its workspace trust entry.

## Independent drive: predictions before launch

- With the managed watcher running, I expect the first turn to end on the requested promise and the thread to be idle, with no guard follow-up.
- After idle Stop, I expect the watcher receipt to say `killed` and the same BB thread to receive an automatic notice naming the watcher and its outcome, then reply `ack` without my sending another prompt.

## Independent drive: observed

On `0f18b65b`, `mise run setup` and the launch above produced @thread:thr_vgq78uyurq (`env_8bms3wikxd`, ready) in this checkout's `.wm/` workspace. Both predictions held:

1. BB reported the thread idle and showed the exact promise. The process receipt named `watcher-first-use` and was `running`; the Pi session had no custom follow-up message.
2. I stopped the idle thread. The receipt became `killed` and the watcher PID was gone. BB displayed the automatic notice naming `watcher-first-use` and saying it stopped when the runtime shut down. A new Pi PID started on the same thread, which replied `ack` about 23 seconds after shutdown. I sent no prompt after Stop.

The cleanup command completed. No unresolved friction. For replay, check the parsed session message type for the guard follow-up: a raw search for `promised-wake` can also match this checkout's name in paths. Allow the automatic turn time to start after Stop, and verify its reply before cleaning up. This exercises explicit idle Stop, not timed lease expiry.

## Implementer observations

- The first turn completed (event 28) with the exact promise and no `promised-wake` message. The managed watcher was `running` and its PID was live just before idle Stop.
- Pi quit and the watcher PID exited. The receipt changed to `killed`: “Stopped when the Pi runtime shut down.” BB received the automatic notice (event 29) and started a new turn (event 32) in a new Pi process on the same thread. Its reply was `ack`. The fixture thread was stopped and archived after the check.
- On the same checkout the [offline guard replay](../guard-refuses-promised-wakes-with-no-live-process/index.md) refused the promise once with no live watcher and let the repeated turn end. With a live watcher it let the same promise stand.
- The [active Stop run](../released-pi-runtime-wakes-threads-with-live-watchers/index.md#active-stop--held) in the release ticket remains the paired control: interrupting a running turn did not wake it. The joined run uses idle Stop rather than waiting 30 minutes for lease expiry.
