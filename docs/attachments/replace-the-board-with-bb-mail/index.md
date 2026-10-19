# Residual bb coordination join

Independent drive at `28aaa64c6cd744785cf9591e5a4cdea0dbdf2051`: [predictions, encounter and replayable checks](drive.md). Supplied isolated SDK encounter completed successfully; both joined claims held. Nonvisual evidence; no screenshots.

Implementation starts at `7d516b08`; production changes are `a9d3f508`. Children already supplied live notice settlement, desk cleanup and end-to-end bb reconcile evidence; this encounter exercises the missed tracker-plugin consumer without repeating that live run.

## Prepared first use

Deployment: isolated backend SDK fixture; no plugin installed/reloaded in the shared bb server. Persona: an existing bb thread (`BB_THREAD_ID`) with ordinary local bb access, no new credentials. The fixture owns a uniquely named temporary Git checkout, a fixture-only vault issue, isolated pin state and its own `desk/ROLES.md`. It uses the real desk writer and pinned tracker CLI. The SDK captures message sends rather than delivering anything to the current thread. Shared roles are untouched; the temporary checkout is removed on exit.

From this candidate checkout, the runnable entry point is:

```sh
npm ci --prefix bb/tracker --ignore-scripts --no-audit --no-fund && bun docs/attachments/replace-the-board-with-bb-mail/encounter.ts
```

Observed ready and successful on `a9d3f508`, with bb SDK 0.6.49. No servers, pages, real workers or deployments were started by this encounter.

## Observed behavior

- `supervisors` found the standing thread through the fixture's `desk/ROLES.md` without plugin metadata or pi subscription records.
- `supervise` with both the role target and an explicit thread ID returned that thread ID and `queued to the supervisor`. Captured SDK calls used `mode: queue-if-active` (the SDK equivalent of CLI `--mode queue`) and the ready issue's wikilink. No real messages were sent.
- Removing the role holder from the SDK's live thread listing omitted it from supervisors; sending to the unavailable role raised `No live supervisor in desk/ROLES.md`. Clearing the fixture role also returned no supervisor.
- Existing joined evidence remains [desk](../desk-helper-for-convention-files/index.md), [local notice settlement](../drop-reconciler-worker-notices-in-a-bb-plugin/index.md) and [live bb reconcile](../move-coordination-off-the-board/index.md). This implementation encounter is not a new live UI acceptance run.

## Checks

- `bb plugin build bb/tracker`: backend and frontend artifacts built.
- `bb/tracker/node_modules/.bin/tsc --noEmit -p bb/tracker`: passed.
- `bb plugin types bb/tracker --check`: passed after the separate SDK-pin repair `c992b740` (0.6.37 → installed host 0.6.49).
- `bun test lib/reconcile lib/thread extensions/bb extensions/supervision`: 42 passed, 0 failed, 311 expectations.
- `bunx tsc --noEmit`: passed.

No new permanent regression tests were added. Fresh driving/review owns independent acceptance of this residual seam.

## Review

Reviewed `138b27d1..9104e463`. One repair (`9104e463`): a failing `desk/ROLES.md` lookup in the tracker plugin now logs a warning and yields no role holder, instead of failing the whole supervisors list (the removed `roleHolders` tolerated errors). Re-ran the encounter on the repaired head: same outputs, exit 0. Re-ran `bun test lib/reconcile lib/thread extensions/bb extensions/supervision` (42 pass), tracker `tsc` and `bb plugin types --check`. No remaining board/role-topic references in `bb/tracker`. Structural pass: nothing worth consolidating; the tracker's role lookup reuses `lib/desk.ts` `roleThread`.
