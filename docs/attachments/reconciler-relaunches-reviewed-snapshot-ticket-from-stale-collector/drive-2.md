# Independent replay encounter

## Before first use

Tested revision: `8bc4aee6cbcaa4ce8eb65cb5f95a9e4a01006ad5`.

Surface supplied by the implementer: `bun test lib/reconcile/scheduling.test.ts`. This is the authorized offline replay surface; no browser, authentication, live deployment or shared fixture import is required. The runner owns isolated temporary Git repositories/global trackers and fake-bb workers, and is responsible for removing them and stopping its reconcilers.

Predictions from the ticket and setup handoff, recorded before running:

1. A worker reporting `waiting` stays owned: replaying the stale collector sequence starts no second implementation while it waits.
2. A reviewed upstream delivery survives the stale nested collector and is recovered rather than reimplemented.
3. After two launches with the same node, base and prerequisites, a third attempt produces one exception rather than another worker. Repeated observation should not duplicate the exception.

Action planned: run the supplied replay command on this checkout and record its observable case names, outcomes and exit status. This encounter does not inspect source, tests or fixtures. Runner results establish the replay claims, not a live reproduction of the historical Concept import.

## Observed replay

The supplied command exited successfully on 2026-11-12: **2 pass, 0 fail, 34 assertions**, in 10.87 seconds. The named replay “reviewed snapshot delivery catches up its stale collector, retains a waiting worker, and caps identical implementation launches” passed. The companion collector-local landing/blocker/foreign-claim replay also passed.

All three predictions were met at the supplied replay surface. No failures or unresolved usage frictions occurred. The runner summarized the compound scenario as one passing case; its output did not expose individual transition receipts. No live Concept import or production reconciler was exercised. No source, test bodies, fixtures or diffs were inspected.

## Replayable checks

Run `bun test lib/reconcile/scheduling.test.ts` at the tested revision. Accept: exit zero, the named reviewed-snapshot/waiting-worker/identical-launch case passes, and no failing assertions. The expected scenario outcomes are no replacement while waiting, stale collector delivery recovery, and one exception at third identical admission. These outcomes are asserted by the supplied offline runner; they were not separately inspected in temporary repository state.

## Cleanup

The replay process exited. Temporary setup and cleanup were delegated to the committed runner as specified in the setup handoff. No server, browser, tunnel, live cache lock or external deployment was started by this driver.
