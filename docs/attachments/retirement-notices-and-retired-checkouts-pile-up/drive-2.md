# Retirement acceptance encounter — drive 2

## Before use: predictions

From the ticket and supplied entry point only:
1. Running the supplied acceptance runner will demonstrate retirement of a finished worker with declared `.captures/x` plus routine ignored setup output. I expect one owner notice for the declared path, and no notice for routine output.
2. I expect the runner to demonstrate merged-branch pruning of routine-only retired state while preserving declared captures.
3. I expect the runner to cover routine retention in the reconciler log and `RETIRED.md`, without needing a supervisor turn.

## Setup

Developer/test-runner persona; no auth or remote deployment. Target is this checkout, `/home/mlegls/dev/mlegls-pi__worktrees/retirement-notices-and-retired-checkouts-pile-up-drive-2`, revision `f654468fdccc13d45ffa3019af4a2aa79d3f8c56`. Initial working tree clean. Implementer supplies `bun test lib/reconcile/retirement.test.ts` with readiness `passed`. No external seed or deployment selectors supplied or needed for this local runner. This encounter uses that explicit acceptance-runner surface and does not inspect implementation, tests or fixtures.

Results pending; predictions recorded before invoking the entry point.
