# Independent activation drive

## Before first use

Persona: developer operating the documented no-model CLI/library rehearsal. Setup: checkout-owned invocation creates a disposable Git target and isolated global Tracker, with no authentication; shell workers seed a spec root and ticket child. Entry point: `bun docs/attachments/reconcile-with-global-tracker-and-landing-ledger/sparse.ts`. Worktree setup has completed per supervisor.

Predictions from the ticket and runtime guide, recorded before execution:

1. Actual owning workers and run collectors omit docs/issues but retain docs/attachments; canonical CLI reads the child contract from a sparse worker.
2. Updating the global contract leaves predecessor code HEAD fixed; handler and successor see fresh rulings, and drive:none skips drive while retaining both code ancestries.
3. Actual integration refuses a forced tracker edit without moving destination/source HEAD or retiring its worker.
4. A code-only integration succeeds and retires its worker.
5. The rehearsal reports readiness through setup/launch and cleans its temporary target and registered resources.

No source, tests or fixtures inspected. This invocation is the supplied setup/first-use entry point, not a retained test-suite run.

## Encounter

Tested revision: `16ccd59a39b0c298318fd13231df3f6210b1e5f1`, 2026-10-12. Ran the entry point above unchanged; completed successfully in 28 seconds. Owned target: `/private/tmp/rc-global-sparse-RtJwVx/repo`; actual worker `child-implement-1` and collector `root--tree` were beneath its fixture-owned repo__worktrees. Setup output reported `setupReady: true`.

| Story / prediction | Observation | Outcome |
| --- | --- | --- |
| Sparse owning worker and collector | Rehearsal reported issuesAbsent, attachmentsPresent and canonicalCliRead all true. | held / met |
| Fresh global contracts without code movement | Fixed worker HEAD `2498bd9dd9315f0d19cda9b37d3f4fc36ea3cd5e`; handler saw Global ruling one; successor prompt and setup saw Global ruling two. driveNone, predecessorAncestry and collectorAncestry all true. | held / met |
| Refuse tracker-edit integration without mutation or cleanup | Error: Forbidden tracker changes: docs/issues/child.md. Mutations belong through the tracker, not code branches. Destination remained `dbb24d8337d642fca80d575bcd04fa995382e1c8`; source remained `7f2cfcde6654a5831f256ea78857ebe7bd3308e0`; refusedWorkerRetained true. | held / met |
| Code-only integration | Destination advanced to `6f2d76065a5a50619faaa0e4c58480da99e4f21d`; codeOnlyWorkerRetired true. | held / met |
| Owned cleanup | Independent shell `test ! -e /private/tmp/rc-global-sparse-RtJwVx` succeeded after process exit. | met |

The entry point's final RESULT reported sparse, freshness, refusal and codeOnly true. These are observations through the supplied production rehearsal, not an independent inspection of its implementation. No rendered UI; no screenshots.

## Frictions and replayable checks

No product-use friction encountered. Process wait abbreviated the last integration record; reading the retained four-line stdout recovered the complete head and retirement evidence.

Replay the supplied command on the reviewed checkout. Accept only setupReady plus all four final outcomes true; confirm the refusal's before/after source and destination hashes match, its worker remains retained, and code-only worker is retired. Confirm the emitted temporary parent directory is absent after exit. Freshness requires both prompt/setup rulings and both ancestry flags, not merely successful process exit.

## Scope

No source, diffs, tests or fixtures read; no product repairs or retained checks run. Required repository test/typecheck results remain the implementer/reviewer responsibility. Longer scheduler/restart/refinement journeys belong to the following scheduler-mode tickets, as specified by this ticket. The parent should link this packet from the global ticket Result through Tracker (not a branch-file mutation).
