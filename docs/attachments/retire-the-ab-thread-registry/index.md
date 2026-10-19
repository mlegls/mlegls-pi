# Parent-node drive scope

Revision: `cae70a08b66c70be51b2a6f64639f0b1e972d29f`.

## Predictions before product use

No additional parent-only journey is specified. I expect the parent contract to be exhausted by its three children's encounters: worker identity/recovery, environment lifecycle, and removal of the old CLI with a live reconcile spawn/integrate/retire journey. Consequently this pass should not repeat those encounters or claim their outcomes anew.

## Scope encounter

Read the parent and all three child contracts through the global tracker (`issues.ts text` and `tree`). The parent assigns record-field replacement and preserved worktree ownership; these map to the child contracts. In particular, the end-to-end reconcile journey is already explicitly required by `delete-ab-thread-and-the-registry`, not an additional parent story. No parent-only story remains. Prediction met.

Per the assignment's explicit instruction for this case, stories are empty. This is scope verification, not a new product acceptance measurement; it neither overrides nor waives child gates or their evidence limits.

## Setup and observations

The supplied setup handoff was null; the user separately reported worktree setup complete. No product deployment was opened, no shared service was touched, and no seed/authentication was needed for this scope-only pass. No source, diffs, tests or fixtures were inspected. No tests were run. No rendered journey, screenshots, or owned services.

## Frictions and checks

No new product friction encountered. No additional replayable product checks arose. To replay the scope decision, read `retire-the-ab-thread-registry` and its three children through the tracker: every parent's requested replacement and lifecycle claim must have a child owner. This held for the contracts read in this pass.

Stories: `[]`. Visual: false. Shots: `[]`.

## Join review

Reviewed the combined change of the three children (base `0fd64560`..head; the supplied `13f2a4a6..HEAD` range holds only tracker docs because the children had already landed on the collector). Stories: none parent-only; the children's gates stand on their own packets.

Seams checked: every record field in the parent contract has a new home (bb thread id → `WorkerThread.id`/`Handle.bb`; worker identity → bb title `<run>/<handle>` and run state; ownership → `workerOf` requires a linked worktree on a branch and only wm/reconcile spawns make them; merge target → `branch.<b>.ab-parent`; dropped fields gone with `listThreads`/`threadSnapshot`). No remaining reader of `~/.local/state/ab-threads`, `AB_THREAD_ID` (outside test env scrubs), `lib/thread/registry|cli`, or `ab thread`; `bin/ab` offers only `desk`. `tsc --noEmit` clean. Tests: `lib` + workspace/bb/supervision extensions 154 pass, 1 fail (`tracker-github` rate-limit reconciler test, timing under load; passes alone, unrelated file); after repairs `lib/reconcile lib/thread lib/wm-reattach lib/dispatch extensions/bb` 47 pass, 0 fail.

Repairs (comments/dead code only, behavior-preserving): stale "registry" comments in reconcile.ts, pr-types.ts, wm.ts now say bb thread; removed `waitBb` (unused before) and `openBb` (orphaned by the deleted `attachThread`); `reconcile/main.ts` stop uses the shared `commonDir` helper instead of its own `git rev-parse --git-common-dir`.
