# Managed-process restart recovery: implementation handoff

The fix lives in **pi-processes**, not mlegls-pi. Code commit `876e86041fb5abb2a80fe6d3e55759bda10b7ec1`, branch `waiting-worker-process-recovery-implement`, based on `local-integration` at `da2792137a75980875ca22d31c69901fd342dbdc`. Prepared checkout: `/home/mlegls/dev/pi-processes__worktrees/waiting-worker-process-recovery-implement`. The parent must integrate that branch into pi-processes; landing this evidence-only mlegls-pi branch does not land the fix. Neither canonical checkout was merged or pushed.

## Behavior

Saved Pi sessions now keep a bounded process registry and logs in `<session-file>.processes/`. Session startup restores receipts by name and ID. Shutdown still stops managed groups; on wake, `output` and `wait` explain the interruption and name retained logs. Completed receipts retain their outcomes too. Ephemeral sessions retain the existing temporary-directory cleanup. A restart replays retained output on its first `output` read; `clear` and oldest-finished-record eviction delete the corresponding logs.

Recovery restores receipts, without adopting old numeric PIDs. If Pi disappeared before recording completion, the receipt reports an unknown outcome and explains that surviving descendants are no longer managed.

## First-use entry

Environment: local Pi extension, agent persona, no authentication or credentials. The entry creates and removes its own `/tmp/pi-process-restart-*` target, isolated Pi settings and saved session header. It invokes the registered process tool through a fixture slash command, without a model call. Dependencies are prepared in the checkout's ignored `node_modules/` using links to the existing repository installation; a fresh checkout can use the repository's `pnpm install --frozen-lockfile`.

```sh
cd /home/mlegls/dev/pi-processes__worktrees/waiting-worker-process-recovery-implement
PI_PROCESS_TEST_PI=$(mise which pi) node test/restart-probe.mjs
```

Opened successfully with installed Pi **1.5.0**, and with repository Pi **0.85.0** (omit `PI_PROCESS_TEST_PI`). The script starts a foreground command, waits for `retained-before-release`, yields to an idle RPC runtime, closes its input to release Pi, and starts a distinct Pi process on the same session. Readiness is observed through the tool's output wait before release. It then calls `output`, `wait`, and `logs` by name, prints their reports, and clears the record. It stops its Pi processes and managed group and removes its target, including on failure. No server or resident target remains.

## Observations

- Baseline pi-processes `da27921` with installed Pi 1.5.0 reproduces the reported error after the same release/restart: `Process not found: restart-probe. No processes have been started in this session.` This was observed by temporarily pointing the fixture import at the unchanged canonical baseline, then restoring the import.
- The committed implementation resolves `restart-probe` in a new Pi process. `output` retains `retained-before-release`, says `Stopped when the Pi runtime shut down`, and gives the retained stdout/stderr paths. `wait` says `was interrupted`, repeats the retained marker, and names the logs. `logs` points to a readable stdout file containing that marker.
- The ticket-authorized restart regression is `src/restart.integration.test.ts`; it launches the real Pi RPC probe, rather than only reconstructing an in-memory manager.
- Affected checks passed: TypeScript, Biome, 120 tests across manager, real-process integration, restart, extension registration, tool registration and wait; then 55 tests across output, process-end reports, start and kill. No full-suite run was performed.

The controlled RPC restart establishes the loss mechanism and recovery. It does not establish which BB lifecycle event caused each historical worker loss; no thirty-minute BB eviction was awaited. Fresh independent acceptance follows this handoff.
