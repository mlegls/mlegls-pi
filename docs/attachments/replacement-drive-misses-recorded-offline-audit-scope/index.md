# Collector refresh: implementation check

Implementation: `99c14ac`. These are implementer first-use observations, not independent acceptance. No model or paid inference ran.

A temporary local Git fixture used `wm.spawn` with a shell worker over isolated zmx, board, thread registry and agent state. The predecessor committed a retained result; its collector then changed the ticket from live product success to offline measurement claims. The successor branched from the predecessor and refreshed the collector before setup/launch.

- Both the predecessor result and collector ruling were ancestors of the successor HEAD.
- The project's setup read the offline ticket, and the persisted launch prompt contained the measurement claims rather than the old task. `ab-parent` remained the spawning collector branch.
- A later-phase checkout received a second collector ruling. Refreshing again made no further change.
- A competing ticket edit left that file conflicted with the collector as `MERGE_HEAD`, available for the worker's first-step resolution rather than silently dropping either history.

The fixture's shell worker was closed and its temporary repository, linked worktrees, zmx state and registry were removed.

The approved regression is `lib/reconcile/refresh.test.ts`: it uses actual shell-worker checkouts and integrates the handler's docs commit before creating the successor. It passed (1 test, 7 assertions), and root typechecking passed. The earlier 26 affected regressions also passed. The earlier next-phase and pending-conflict observations remain temporary diagnostics, not additional permanent tests.

## First-use setup and entry

From the committed checkout:

```sh
mise run setup && bun install --frozen-lockfile --cwd extensions/obsidian-tracker && bun test ./lib/reconcile/refresh.test.ts
```

Required and prepared environment: local Git, Bun, mise and zmx; no Cloud deployment, credentials or paid inference. The entry prepares an isolated temporary repository, board, agent/session store and zmx directory; the collector and worker checkouts are fixture-owned. It seeds a live-drive ticket and predecessor packet, integrates the offline measurement ruling, then opens the successor from the predecessor HEAD. The seed and setup are committed in the regression, not inherited from a worker's ignored files. Readiness was observed by successful setup and shell-worker launch; cleanup closes the workers and removes all fixture state.

For an independent library encounter, the surface is `refreshWorker(successorCheckout, collectorCheckout)` from `lib/reconcile/refresh.ts`, used as the pre-setup/launch callback of `wm.spawn`. Use disposable, owned Git checkouts; the operation merges the collector into the successor, leaving genuine conflicts for its first-step resolution.

## Existing regressions and preparation

`bun test ./lib/dispatch.test.ts ./lib/wm.test.ts ./lib/thread/runtime.test.ts ./lib/thread/lifecycle.test.ts`: 26 passed, none failed. Root `bun run typecheck` initially failed solely on missing Obsidian types; `bun install --frozen-lockfile --cwd extensions/obsidian-tracker` followed by the unchanged check passed. The recurring setup boundary is recorded in [its existing issue](../../issues/root-setup-still-omits-obsidian-typecheck-dependencies.md).

## Historical integration divergence recheck

Read-only source: Concept repository at `/Users/mlegls/dev/mmon/concept`. Disposable shared clones checked out reviewer `b38f1aa2` and immediate collector `ac65571f`; neither original branch/worktree changed.

Before refresh their merge base was `a19fc3d9`. The four non-patch-equivalent collector decisions absent from the reviewer were `d7e61c08`, `a47bf8c8`, `6974f1d8` and `ac65571f`.

The new refresh merged `ac65571f` without rebasing or replaying commits. It left the same six conflicts: `full-turn-replay.md`, `live-replay-capture.ts`, `live-replay-ops.ts`, `run-live-replay.mjs` under the replay attachments, plus the measurement and tooling issues. All four missing decisions were ancestors of `MERGE_HEAD`, whose measurement ticket contained `Review acceptance: measurement claims`.

This prevents a replacement from silently starting without the immediate-parent decisions. It does not undo a historical rebase or automatically resolve that already-divergent branch: the pending merge still needs the authorized additive recovery. No integration gate or inference was rerun, no historical merge was completed, and both disposable clones were removed.
