# Orca integration — 2026-09-21

Baseline: `e489da0434623322c2efcd2d0a3adf539f628aa3`. Local macOS, Pi 0.84.4, Orca 1.4.206. Orca became available during implementation; its runtime was started and the canonical `mlegls-pi` checkout registered as a repository. Existing external Orca skill installations were not edited or committed.

## Observed

- Final existing suite: 203 passed, 2 skipped, 0 failed. `bunx tsc --noEmit` and `git diff --check` passed.
- A real Pi session fork preserved the selected leaf and left the source bytes unchanged. POSIX quoting round-tripped spaces, a single quote, a dollar expression, and a newline.
- A real Pi RPC startup with the reader extension returned its deliberate unavailable-model error through the result-file channel without inference. This caught an initialization bug: custom flags are populated after extension factories run. Reader configuration now uses `PI_AUTOREAD_ID` in its launch environment.
- A Pi TUI was opened in Orca from a disposable copy of the current conversation. `/fork-tab Orca fork probe` returned a new terminal handle. Orca listed two distinct tab IDs under the same worktree, both recognized as Pi. The original stayed open. The child session header pointed to the copied source, and its session file was distinct.
- Exec output rendered in the inherited Pi transcript through Orca’s terminal. File completion, image input, and interactive extension dialogs were not exercised.
- `dispatch.dispatch` created `orca-probe-worker` as an explicitly nested worktree under the canonical checkout. The worker used the selected OpenRouter DeepSeek model and returned `ORCA_WORKER_OK` via the board. A follow-up board message woke it; it returned `ORCA_STEERING_OK`. Its checkout remained clean.
- A fresh-process `autoread.run` with explicit Orca backend, no compaction, and memory disabled launched a visible reader and returned exactly `ORCA_READER_OK`, with a new session path and terminal handle. Afterwards Orca reported the reader disconnected, unwritable, and operator-closed while retaining its transcript preview.
- Terminal handles are not durable after closure: later cleanup of the stopped reader returned `terminal_handle_stale`. Follow-up readers use the Pi session path, not the terminal handle.
- Probe tabs were closed and the clean probe worktree removed. Orca listed no remaining terminals in the canonical checkout after cleanup. Session/result evidence remains in Pi’s local storage.

## Remaining checks

Compaction, native structured submission, abort/timeout against an active reader, Pi restart/history integration, full agent-status transitions, image rendering, and graphical review/merge were not exercised. Orca accepts Pi terminal input but its send receipt reports `provider: unsupported`; observe the terminal or board result rather than treating input acceptance as delivery. See [[projects/mlegls-pi/issues/orca-terminal-launch-parity]].

## Size

`scc-delta.sh` against the baseline, scoped to `lib` and `extensions`, excluding installed `node_modules`: code 12,219 → 12,242 (+23); complexity 3,041 → 3,019 (−22). The unfiltered working-tree scan includes local dependencies and is not a meaningful source delta.
