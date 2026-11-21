# Independent supervision drive

## Predictions before first use

- Pi: a fresh caller sees the BB supervision tools in codemode. `reconcile_status` answers `[]` for the absent issue. `dispatch` creates a worker whose `parentThreadId` is the Pi caller; `integrate` lands the worker's committed marker in that caller's checkout.
- Codex: a fresh caller can do the same via BB native tools, with the Codex caller as parent and its separate checkout receiving the marker.

## Setup and observed results

Followed [the drive setup](drive.md) at mlegls-pi `e01c1054` and companion `aeb4f68`, using BB 0.50.1 on loopback ports 45731/45732. `bb status --json` confirmed the disposable data directory and `bb machine list` showed the local machine connected before plugin installation. Built and installed a disposable copy of the companion plugin, pointing its checkout setting at the drive worktree. The synthetic project started from a local clone with separate clean Pi and Codex caller worktrees. Pi used the host login and model config with isolated codemode settings; Codex used the existing host login. Shared live BB was untouched.

Both predictions were met. The Pi verbose thread log showed codemode discovery and invocation; the Codex verbose log showed native tool calls. Both `reconcile_status` calls answered `[]`. Each dispatch returned one submitted worker, which reported `done`; each native integration fast-forwarded its caller's checkout. Independently inspected `bb thread show <worker> --json` and read `SUPERVISION_SMOKE` from each checkout's `HEAD` after integration. Both working trees were clean.

| Caller surface | Caller | Worker | Observed worker `parentThreadId` | Landed commit | Marker |
| --- | --- | --- | --- | --- | --- |
| Pi codemode | `thr_prgkr7ydq8` | `thr_i59yhqkwwf` | `thr_prgkr7ydq8` | `ac81b63b` | `native-pi` |
| Codex native | `thr_bpmk2zbhqk` | `thr_wfbxn56t9d` | `thr_bpmk2zbhqk` | `a71b893d` | `native-codex` |

Both workers were archived with their parent link intact. No friction in either required journey. Stopped the disposable BB and removed its temporary fixture.

## Replay checks

1. Run [First use](drive.md#first-use) on the prepared disposable instance. In `bb thread log <caller> --format verbose`, expect native status/dispatch/integrate events for Codex and codemode invocations for Pi, with status returning `[]` and dispatch submitting exactly one worker.
2. Run `bb thread show <worker> --json` and compare `thread.parentThreadId` with the caller ID, including after integration archives the worker.
3. In each caller checkout, run `git show HEAD:SUPERVISION_SMOKE` and `git status --short`: expect the provider-specific marker and no local changes.
