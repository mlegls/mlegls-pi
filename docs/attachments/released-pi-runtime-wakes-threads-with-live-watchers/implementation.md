## Managed watcher release first use

Tested `8b1f735d` on Beelink with real BB Pi threads. The fixture ran the candidate [BB extension](../../../extensions/bb/index.ts) and the installed pi-processes with session receipts (`cf46be7`). It used the existing authenticated Pi provider, `openai/gpt-6.2-sol`, in project `proj_xzgxqiaesb`. No provider or host settings were changed. The only temporary Pi trust entries were for the owned fixture directories.

### Try it

From the candidate checkout with `mise run setup` already complete and a live local BB Pi provider, run [first-use.ts](first-use.ts):

```sh
bun docs/attachments/released-pi-runtime-wakes-threads-with-live-watchers/first-use.ts release
bun docs/attachments/released-pi-runtime-wakes-threads-with-live-watchers/first-use.ts stop
```

Run one case at a time. Each command prints the real BB thread `id` and fresh workspace `root`. `BB_PROJECT_ID` selects the project; `BB_THREAD_ID`, when set, ties the fixture's lifecycle to the calling thread. `BB_WAKE_MODEL` can select a different authenticated Pi model. The workspace has no prior session or processes. The first turn starts `watcher-first-use` (`sleep 300`), and `$root/runtime.jsonl` records Pi session file and PIDs. The corresponding `<session file>.processes/registry.json` shows whether the watcher is live. Confirm the environment is `ready` with `bb thread show "$id" --json` before releasing it.

- **Release:** wait for the first turn to yield `ready`, and confirm a `running` watcher in the receipt. Run `bb thread stop "$id"` on this **idle** thread. This is BB's documented equivalent of its idle runtime release. `bb thread log "$id"` should gain a shutdown notice and the agent's `ack`, both on the same thread. The trace should show the old Pi quitting and a different PID starting on the same session file.
- **Stop:** wait for the watcher to be `running` while BB shows the turn `active` (the thread is in `process wait` in its log). Run `bb thread stop "$id"`. The interrupted turn should be the last one, with an empty `bb thread queue list "$id"` and no `release-wake.log` in its receipts directory.

After either case, run `bun docs/attachments/released-pi-runtime-wakes-threads-with-live-watchers/first-use.ts clean "$root"` to archive and stop the precise thread and remove the fixture's trust entry.

### Observed

- **Idle release woke the thread.** @thread:thr_pkbs26k45d, `env_hydz7emvty` ready. Pi `3467321` settled normally, and the watcher PID `3473850` was still running. Idle Stop caused `session_shutdown` (`quit`) at `02:19:20.141Z`; both PIDs exited. BB accepted the automatic tell at seq 30, ~2.2 s after shutdown. It named `watcher-first-use` (`proc_1`) and carried the saved outcome, “Stopped when the Pi runtime shut down.” The same thread started seq 33, ~13.5 s after shutdown, in Pi `3487065` on the same session file, and replied `ack`. No input was sent after the idle release by the operator.
- **Active Stop did not wake the thread.** @thread:thr_cj6e2y9z9a, `env_pyam9fkpae` ready. BB was `active`, with `process wait` in flight and watcher PID `3494760` still running. Stop logged `manual-stop` (seq 24) and an `interrupted` completion (seq 28). Pi `3487337` emitted `agent_settled` with `aborted: true`, then `session_shutdown` (`quit`); the manager saved the killed receipt. Both PIDs exited. No helper log, additional requested turn or queued message appeared before teardown.

Both fixture threads were stopped and archived, and their trust entries removed. No service remains running. The timer itself was not awaited; both scenarios used BB's real `thread stop` against the indicated run state.

Existing affected checks: 8 passes across `extensions/bb/reconciler-notices.test.ts`, `lib/thread/bb-pi.test.ts`, and `lib/thread/runtime.test.ts`; `bun run typecheck` passed.
