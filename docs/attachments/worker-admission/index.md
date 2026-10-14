# Worker admission first use

Implementation: `9b844cd`. These are implementer self-checks, not independent acceptance.

The worker runner now uses GNU parallel's host-wide `workers` semaphore, separate from `heavy`. Dispatch returns a submitted handle while its runner waits. Setup starts only after a slot and memory are available. Queued workers appear in reconciler status, the text tree, the sidebar and Threads. Workspace process/RSS counts include services; they do not consume separate slots.

## Reproduce

Required: Bun, GNU parallel's `sem`, mise and this checkout's zmx installation on PATH. No credentials or model calls.

From a checkout with dependencies prepared (`mise run setup`):

- `bun docs/attachments/worker-admission/fixture.ts prepare capacity`
- `bun docs/attachments/worker-admission/fixture.ts prepare pressure`

Each command creates and prints its own `/private/tmp/worker-budget-*` target. It owns two temporary repositories, worktrees, an isolated thread registry, zmx directory and `PARALLEL_HOME`. A shell named `pi` stands in for workers; the pressure probe reads fixture JSON. The real host semaphore, sessions and apps are untouched. There is no resident dev server or authentication persona.

Use the printed root as `ROOT`:

- `bun docs/attachments/worker-admission/fixture.ts inspect ROOT`: thread state and the real `reconcile_status` projection over seeded, paused reconciler caches. No autonomous reconciler runs in this fixture.
- `bun docs/attachments/worker-admission/fixture.ts threads ROOT`: thread CLI, including queued reason and workspace census.
- Capacity: `bun docs/attachments/worker-admission/fixture.ts retire ROOT first`.
- Pressure: `bun docs/attachments/worker-admission/fixture.ts low ROOT`, then inspect after the next two-second probe.
- Finish: `bun docs/attachments/worker-admission/fixture.ts cleanup ROOT`. This retires only registered fixture workers, removes their worktrees/branches, then deletes the owned fixture directory.

`prepare` waits for the seeded admission/setup state, then prints its initial observation. It does not assert acceptance; the fresh driver owns that.

## Observed

Two independent dispatch processes in different repositories shared a one-slot pool:

- Owner A's `first`, thread `a0721776-ceed-4b38-a85b-615ea0b2fbe0`, was running; owner B's `second`, thread `6cc31470-b08f-43e8-b0c8-4da357561c9c`, was queued with reason `worker slots`. The second worktree had no setup marker.
- Both owners received submitted handles with empty pending lists; queueing was not a launch failure.
- Retiring A closed its thread and killed six owned processes. B became running at `2026-10-08T09:35:21.561Z`, with setup prepared.

Forced-pressure dispatch:

- Thread `c46dada5-558b-482f-8cf5-45ff44f44f3e` waited with `memory free 1% < 10%`; setup had not run.
- After changing the probe to 80%, it became running at `2026-10-08T09:36:03.968Z`, with setup prepared.

Status/tree observations:

- The paused reconciler cache's chain showed the same queued admission reason and thread identity.
- The text tree printed `⌛ owner-b/second queued: worker slots` and `⌛ owner-a/first queued: memory free 1% < 10%`.
- Thread listings reported workspace processes and RSS beside each worker. These are a cwd census, including the runner's infrastructure, not a count of independently budgeted servers.

The initial shell-command fixture also exercised the same two waits through `wm.spawn`. All temporary fixtures were retired and removed.

## Regression checks

- 37 existing tests passed across affected thread lifecycle, CLI, wm, dispatch, reconciler stop/constraints and tree files.
- Tree regressions re-run after the graph join change: 6 passed.
- `bun run typecheck` passed.
- Swift Registry typecheck and Controller/Registry syntax parse passed. No native app build or visual encounter was performed; native sidebar driving remains with the fresh verifier.
