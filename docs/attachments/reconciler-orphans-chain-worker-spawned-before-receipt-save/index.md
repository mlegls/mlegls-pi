# Chain launch recovery verification

## Predictions before first use

From the ticket and setup handoff only, without reading implementation or tests:

1. With a saved `launching` name and an existing titled worker, the recovery runner should report adoption without launching another worker.
2. With the same saved state but no matching worker, it should report exactly one launch using the saved name.

## Setup and reproduction

Tested revision: `65ef0c3498d5cf07ea35e6f93034de40e16e2252`.

Run `bun test lib/reconcile/launch-recovery.test.ts` from the worker checkout. The assigned surface is an offline fake-bb CLI and temporary Git repository, fixture-owned and cleaned up by the runner. Persona is the fake worker backend; no credentials, browser, service or ports are required. The entry file and Bun executable were confirmed available before execution. No inherited deployment selectors were reused. This is fixture-based CLI evidence, not a live bb crash experiment.

## Encounter and outcomes

Executed the handoff entry point without opening source, diffs, tests or fixtures. Bun v1.4.4 completed in 4.32 seconds, exit 0: **1 pass, 0 fail, 11 expect() calls**. The named passing case was `an interrupted chain launch adopts its titled worker or launches once under its saved name`.

| Story | Action and observed result | Outcome |
| --- | --- | --- |
| Adopt an existing titled worker after interrupted launch | Run the assigned recovery case; its adoption-or-launch case passed. | held within the supplied fake-backend runner |
| Launch once under the saved name when no worker exists | Same entry point; the combined adoption-or-launch case passed. | held within the supplied fake-backend runner |

## Expectations and frictions

Both pre-use predictions were met at the runner's pass/fail surface. The CLI reports the two scenarios as one combined case, rather than printing separate adoption and launch receipts; the observations therefore rely on that provided case's assertions, not independent inspection of worker state. No unresolved execution friction was encountered. No rendered journey was involved, and no services or external resources were started.

## Replayable checks

- Run the command above from this revision. Accept exit 0 and the named recovery case passing with no failed cases. This checks the supplied existing-worker and missing-worker scenarios.
- A failure in either branch should make that case fail rather than leave an apparently green runner. Sensitivity was not modified or independently challenged during this read-only drive.

The assigned setup deliberately uses fake bb, so this packet makes no additional claim about real-process crash timing, actual bb thread adoption or browser behavior.
