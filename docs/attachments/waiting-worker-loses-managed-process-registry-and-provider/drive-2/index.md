# Restart recovery: independent drive

## Predictions before use

- A managed process started in a disposable saved Pi session will emit a readiness marker before that Pi is released.
- Starting Pi again with that saved session will let the agent find the process by name through output/wait, with its earlier output retained. If it died, the response will identify that state and retain a log path rather than report an empty registry.
- The supplied restart probe will finish with an explicit result and clean up its own disposable processes and targets.

## Setup

Local Pi extension at `/home/mlegls/dev/pi-processes__worktrees/waiting-worker-process-recovery-implement`, revision `876e86041fb5abb2a80fe6d3e55759bda10b7ec1`. Agent persona; no authentication or model calls. Disposable saved session; dependencies prepared by implementer. Confirmed checkout and entry script exist before launch. This is the explicitly supplied CLI acceptance entry point; no implementation, fixtures or test source inspected.

Reproduction:

```sh
cd /home/mlegls/dev/pi-processes__worktrees/waiting-worker-process-recovery-implement
PI_PROCESS_TEST_PI=$(mise which pi) node test/restart-probe.mjs
```

## Encounter

2026-11-09: Ran the supplied entry point as a managed foreground process. It exited 0 in approximately one second.

1. Readiness: observed `waiting: restart-probe printed its marker; releasing the idle Pi runtime` before release. Prediction met.
2. Recovered lookup: the fresh runtime found `restart-probe` (`proc_1`) by name and reported `[killed]`, one stdout line and zero stderr lines. It explained `Stopped when the Pi runtime shut down. Resume the command explicitly if still needed.` Prediction met for the ticket's interrupted-process alternative.
3. Retained evidence: output/wait included `retained-before-release` and explicit stdout/stderr paths under `/tmp/pi-process-restart-lWEUPX/session.jsonl.processes/`. No empty-registry error appeared. Final result: `Restart recovery passed: fresh Pi resolves output/wait/logs by name.` Prediction met.
4. Cleanup: after completion, independently checked that `/tmp/pi-process-restart-lWEUPX` no longer existed. The target checkout remained clean. No service or browser was launched by this driver.

## Claims and replayable checks

- **Held:** interrupted managed-process lookup after a Pi restart retains its name, termination explanation and pre-release output/log paths. Replay the command above; accept only readiness before release followed by named killed/interrupted output, the original marker, retained paths and exit 0.
- **Held:** the supplied restart regression probe reproduces the release/restart path and reports success through the CLI. Replay the same entry point and require `Restart recovery passed: fresh Pi resolves output/wait/logs by name.`
- **Boundary:** this encounter uses the implementer's explicitly supplied disposable-session CLI probe. It does not independently observe BB's real half-hour idle eviction or establish the historical lifecycle cause. It exercises the ticket's allowed dead-process recovery outcome; continued execution of a live child was not claimed or observed.

## Frictions and expectations

No user-facing friction in this bounded encounter. All three pre-use predictions were met. The retained paths are intentionally removed by the disposable probe's cleanup, so they document paths shown at recovery rather than permanent packet artifacts. The durable evidence is this encounter summary. No rendered UI; screenshots do not apply.

## Review

Reviewed pi-processes `876e860` (diff against `da27921`) with the driver's packet. Diff read against the ticket: receipts and logs persist in `<session-file>.processes/`, restore on `session_start` by name/ID without adopting old PIDs, interrupted records explain the shutdown and name retained logs; ephemeral sessions keep the temp-dir behavior. No defects found in the implementation.

- Re-ran `PI_PROCESS_TEST_PI=$(mise which pi) node test/restart-probe.mjs` on the implementation: exit 0, same output as the drive (killed/interrupted, `retained-before-release`, log paths, "Restart recovery passed").
- `tsc --noEmit` clean; `restart.integration`, `manager`, `index` tests pass.
- Flake found: `manager.test.ts > cancels readiness when the process exits first` failed ~3 of 8 runs on baseline `da27921` when run with the other files (the end event follows real log I/O that fake timers don't await). Fixed in pi-processes `04a1ca0` by wrapping the assertion in `vi.waitFor`; 12 of 12 passes after.
- Boundary unchanged: BB's real idle eviction is not exercised; the process is stopped on release (allowed outcome), not kept running.
