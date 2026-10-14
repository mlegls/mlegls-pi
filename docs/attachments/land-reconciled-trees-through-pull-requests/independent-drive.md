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

## Authorized fixture repair and final replay

Supervisor authorized adapting all four one-off controllers to the current BB-only runtime. Fixture revision `daf01ced` imports an isolated fake BB CLI (the same helper as restored tests) and runs deterministic shell actions synchronously at spawn. Production BB transport, registry, scheduling, integration, hooks, target proof and tracker closure remain unchanged. No daemon/model/sleeping shell is launched; no zmx restored. Prepublication cleanup now checks for a saved PR identity and an existing remote branch before acting. This is a fixture repair, not a PR product change.

All predictions above **met** within the approved live/seeded boundary:

| Story/action | Final observed outcome |
| --- | --- |
| Live owned entry/readiness | `pr-merge` exit 0 in 6m55s. Area `/private/tmp/rehearse-github-pr-o33g7Z`; mlegls/ADMIN/Actions/main. Base b14110418ec29faa3a03b46013d81ecc40c6f4d6 green, check 115952100375. |
| Collector → staging/publication | a 13483a6c5314485f16b03c99a9f991e5d94207df exactly b's start; a global ticket and outside blocked. Nine tree launches; original root ae0c0471aded8f5401e6bb2d85aea91caddc4b06 pending in staging; one [PR #10](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/pull/10). |
| Fault/check repair/restart | Injected one GraphQL 502, public answer continued #10. Red Actions checks 115953231125/115953196212 requested one repair. Exact PID 97358 killed, resumed 19532, same mode/branch/results/cursors/counter=10; zero live workers at restart cut. |
| Histories/gates | Real base conflict with 7ede29e1034b056a5f1ba033ed8ead9c11e1cd38; contributor 67920086f95bc439124f0b3690192478eff67cbb preserved. Final exact-head staging/pre-push gate 3737ff6051dc2cd17fc591cf5d6acaa5c74dbdd0. Normal merge/push, no rebase/force. |
| Green merge → target | Checks 115954604740/115954572118 completed/success; merged at 15:56:56Z, two-parent merge a6de89ae86642bd61321974c8a2b2e9c2016b068. Child-first close subjects a/b/root; closedAt 15:57:12.962Z / 13.134Z / 13.307Z. Original results preserved; outside ready; clean/main owner at merge, ownerSync updated, zero live workers. |
| Seeded submitted-review probe | Exit 0: two posts, one worker, zero host merge calls, five gates. Approval consumed; submitted boundaries coalesced; marker replies ignored; post-before-save replay idempotent; later CHANGES_REQUESTED owner exception; only external merge closed at github:seeded/lifecycle:main. No live changes-requested claim. |
| Seeded checks probes | Normal and publication-zero exit 0; normal eleven gates/four merge hooks, bounded repair and exact-identity crash recovery; transport/pending base hold, contributor/base ancestry, closed-unmerged hold. Zero-check one PR/one guarded merge, fetched merge 29462278c11299ce4a31ea863d1732a6d5d847ff carries ebb3e6b94adcd2e93bfb7526f20f69011694fc72, owner updated. |
| Seeded staging matrix | `staging.ts all` exit 0 in 8m39s. Each clean/dirty/other/divergent/missing case: one PR, nine launches, child-first close, zero replay closes. Clean updated; other four left owner unchanged/unavailable. Fetched merges respectively 48413f7c…, 244b4e7f…, d8b38b25…, 0fd6c00d…, e9414617…. Waiting/restart retained results, refused unproven merge receipt and closed only after fetched ancestry. |
| Cleanup | Original failed area's cleanup exit 0 (`pr:null`, no branch). Completed area's cleanup exit 0, #10 branch deleted, supplied repo/inherited history retained. Exact owned reconciler PIDs 80626/97358/19532 absent. Seeded fixtures retired/deleted private resources. No external service/process remains owned. |

`bun run typecheck` exited 0. No retained tests added or weakened. Documentation now names fake-BB rather than zmx prerequisites. Global friction records the repaired evidence, pending parent target integration before closure. The initial setup expectation failed, then met after authorized fixture adaptation; no remaining encountered friction.

Reproduction uses the five commands in the combined index plus documented cleanup. Accept the action/result rows above; seeded host claims are not live GitHub review or native issue-adapter evidence. Prior approved live review packet remains unchanged. Local scratch areas retained for inspection; parent owns supplied-repository disposal.
