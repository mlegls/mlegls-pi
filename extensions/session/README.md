# Host terminal service

This extension owns persistent tmux terminals and alert delivery. It registers no
model-facing tools. Exec forwards its `term` namespace through the Pi event bus:

```ts
const result = await new Promise((resolve, reject) => {
  const request = { method, args, signal, resolve, reject, handled: false };
  pi.events.emit("term:request", request);
  if (!request.handled) reject(new Error("Terminal service is unavailable"));
});
```

`args` is an array of positional arguments. `signal` is a host AbortSignal, not
serialized through the kernel. Results contain plain data, never tool text:

| Call | Result |
| --- | --- |
| `term.spawn({terminals: [{command, cwd?, name?, notifyOnExit?, notifyOnOutput?}]})` | `TerminalSnapshot[]` |
| `term.wait({ids, mode?, cursors?, waitMs?, lines?})` | `WaitResult` |
| `term.view(id, {cursor?, waitMs?, lines?}?)` | `TerminalSnapshot` |
| `term.send(id, text, {submit?}?)` | `TerminalSnapshot` |
| `term.sendRaw(id, keys)` | `TerminalSnapshot` |
| `term.end(id)` | `{id, ended:true}` |
| `term.list()` | `TerminalSummary[]` |

Types live in `tmux.ts`. Snapshots include rendered `output`, status, and cursor.
Spawn resolves cwd against the active Pi workspace. Batches hold 1–16 terminals.
Wait defaults to `any` (output change or exit); `all` waits for every exit. Wait
cursors map ids to previous snapshot cursors. Wait defaults to 30 seconds; view
wait defaults to zero; both cap at 30 seconds. Capture defaults to 200 trailing
lines, capped at 2000. Send pastes literal text and submits by default; sendRaw
accepts 1–32 supported tmux key names, such as `C-c` and `Enter`.

`session_start` restores the server derived from the Pi session id and resumes
its persisted one-shot alerts. `session_shutdown` stops only the alert monitor:
it does not kill tmux. Exec reset must not stop or recreate this extension;
terminal ids, subprocesses, cursors, and alert state remain host-owned. Cancelling
a request stops waiting/command transport, not already-created terminals. Use
`end` to terminate explicitly (and suppress their pending alerts).
Session start, shutdown, and tree navigation abort outstanding requests; tree
navigation refreshes the active context without replacing the tmux server.
