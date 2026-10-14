# Independent join encounter

Revision: f5ac5b28 (collector merge resolved before setup). Read only the conflict span for the expressly assigned merge; no implementation/test/controller inspection for driving.

## Predictions before contact

1. Collector-local integration unlocks the sibling but leaves global nodes and outside dependents pending; root staging publishes exactly one PR.
2. A failing real Actions check launches one bounded repair; base conflict and contributor push survive ordinary merge history and exact-head gates.
3. Restart and a transport interruption continue the same PR and original results rather than replaying the tree.
4. Green remote merge closes children then root, unlocks outside dependent and fast-forwards clean/base owner; idle wait has no workers.
5. Submitted-review seeded public probe repairs/replies once, ignores marker replies, escalates later changes-requested and closes only following external merge (approved live/seeded boundary in existing packet).

## Setup

Authorized existing private scratch repository: mlegls/reconcile-pr-transport-20261014-35767b2d. Existing gh identity mlegls; isolated state and shell workers prepared by the documented journey CLI. No new accounts/repositories/tokens authorized. Entry: `bun docs/attachments/rehearse-reconciled-github-pr-landings/journey.ts pr-merge`. Readiness must be established by its preflight/green base before workers begin.

## Observations

`mise run setup` exited 0. Documented live entry exited 1 after 54 seconds. Preflight confirmed mlegls/ADMIN/Actions/main and owned area `/private/tmp/rehearse-github-pr-jpO2FR`; fetched base f217e994ca3ae3170fee2cbcc91e13b9ec6158bf. Prepared base d5b1e32776ac7a5966ed2c5aa880f28af49c1913 was green: located-fixture check 115949613329, run 38592181383, completed/success.

Production start PID 80626 launched the first implement worker, but raised owner exception: `bb thread thr_pefwmrbexa ... Command thread.start failed ... Failed to resolve Pi model "stance/shell"`. Entry reached setup/start, not collector, publication or review journeys. All five predictions remain unobservable, not met evidence. Previous packet observations remain historical, not acceptance on this combined revision.

Documented `cleanup /private/tmp/rehearse-github-pr-jpO2FR` stopped the reconciler and retired workers (`stopped; retired workers and handlers, kept collectors`), then exited 1 after 87 seconds querying an absent PR number: `Variable $number of type Int! was provided invalid value`. No browser/server/tunnel started. Supplied repository and owned local area retained; cleanup did not finish remote cleanup.

Friction filed globally outside execution subtree: [scratch-pr-rehearsal-shell-model-unavailable](../../../issues/scratch-pr-rehearsal-shell-model-unavailable.md). No repair attempted in driver role.

## Replayable checks

- Run documented pr-merge command on this revision with current BB harness; accept first worker reporting through owned shell setup, then the five predictions above through completion.
- Invoke documented cleanup after a failure before publication; accept stop/retirement and successful no-PR cleanup rather than invalid-number GraphQL.

No rendered journey: visual false, screenshots none.
