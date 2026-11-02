# Independent operator drive

## Predictions before first use

- A deliberately failing setup will report exit 7 and name a retained log that I can open after cleanup; its output will include `retained-failure-marker`.
- The failed checkout and branch will be removed, without deleting that retained log.
- Repeating the same worker name will produce another retained log, without overwriting the first.

## Setup confirmed

Local library/CLI on this worker checkout, disposable `/tmp/retained-setup-*` repositories owned by the rehearsal. Persona: local operator with supplied fake bb adapter; no authentication, servers or inherited deployment selectors needed. Seed and entry point: the committed index rehearsal, Git repository with mise setup exiting 7. Will run that exact supplied rehearsal rather than inspect implementation or tests.

## Encounter and outcomes

Tested revision: `1f32720461ef70e848f8c3f4a560e9db1af17597`, 2026-11-02. Executed the shell block from [index.md](index.md) unchanged (Python extracted the documented block and passed it to the shell). Rehearsal completed successfully; setup itself deliberately failed twice with exit 7.

Both exceptions named readable retained logs under `/tmp/retained-setup-hifHWA/repo/.git/reconcile/setup-failures/`: `failed-jZrCov/setup.log` and `failed-hWFTvG/setup.log`. Each exception's `see` path matched its `Setup log retained` path. Opening each path after its cleanup printed the setup command, `retained-failure-marker`, and the mise task failure. Both attempts reported `Partial resources cleaned`, `Worktree remains: false`, and an empty branch listing. Thus the original operator journey held: the failure names output that remains available after failed-checkout removal.

Expectations: retained readable marker after cleanup — met; failed checkout and branch removed — met; repeat worker names yield distinct destinations — met. The first log was read before the second attempt, not re-opened after it; distinct paths establish non-collision, not indefinite retention.

Frictions: none encountered in this bounded operator journey.

## Replayable checks

1. Run the index rehearsal in this checkout. Accept exit 7 in the setup exception, a `see` path matching `Setup log retained`, and the marker printed from that path after cleanup. Reject ENOENT or only the deleted checkout path.
2. For each attempt, accept `Worktree remains: false` and an empty branch listing while the retained log is readable.
3. Repeat the same worker name as the rehearsal does; accept distinct retained destinations with readable setup output for each.

## Scope and cleanup

Nonvisual library/CLI drive; no screenshots. Fake bb isolates runtime orchestration, while Git and mise setup are real. No live reconciler launch or intermittent contention diagnosis attempted: this verifies diagnostic survival, not the original unknown setup cause. The rehearsal's finally block removed its disposable root; no servers, authentication changes or external deployments were started.

