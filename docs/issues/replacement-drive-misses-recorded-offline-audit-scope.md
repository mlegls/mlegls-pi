---
stage: idea
assignee: agent
priority: 3
author: session:8b7a8886-119b-4cd8-bceb-d802d71a9915
---

Observed under [[projects/concept/issues/measure-live-classical-chinese-first-turns]], verifying [[projects/concept/stories/plan]], [[projects/concept/stories/session]] and [[projects/concept/stories/meter-managed-usage]]. Owning tool/repository: mlegls-pi reconciler; related owner [[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]].

The handler committed explicit offline-packet verification scope at `9660f4d`, prohibiting further paid inference. The replacement driver returned the same request for fresh inference authorization or offline scope at `569485f`, without inspecting the packet. Its evidence index says it used the prior completed continuation handoff and preserved the ordinary blind-driver restriction against reading fixtures. `git merge-base --is-ancestor 9660f4d 569485f` exits 1: the scope decision is absent from that driver's branch. This establishes missing branch state and repeated clarification, not whether the resolution message was delivered or read.

Workaround: answer again with the complete offline scope, the exact packet entry point, and explicit permission to inspect retained experiment evidence rather than run the launcher. Record that ruling in the measurement ticket. Successful completion of the replacement audit is not yet observed.

Recommendation: ensure replacement workers receive applicable ancestor contract decisions as active setup, including authorized scope exceptions, rather than only the preceding implementer's one-shot invocation. Investigate message delivery and branch refresh before attributing a cause.

## Measurement acceptance versus product-success handoff

At reviewer head `637d157a`, the required integration gate passed, but review remained blocked after an explicit ruling to finish the measurement-only audit while preserving `plan`/`session` failures. The reviewer correctly noted that the standard handoff requires every required story row to be `held`; the scope ruling still left the ticket's Stories line and failed product rows as the apparent required claims. This is a contract mismatch, not a failed gate or an authorization to repair production.

Tried: answer that measurement completion does not require every diagnostic draw to satisfy the product stories, with failures preserved. Outcome: another exception asking for a waiver, explicit story rescope, or a separate production fix. Workaround now recorded in [[projects/concept/issues/measure-live-classical-chinese-first-turns#Review acceptance: measurement claims]]: define the three required measurement claims explicitly, retain failed/unobservable product observations separately, and keep the gate unchanged. Completion under that clarified handoff is not yet observed.

Recommendation: when an authorized diagnostic scope changes acceptance, update the required handoff claims as well as the prose ruling. A negative experiment result must remain negative; checking its capture/classification is a separate claim from the product expectation it falsifies.

## Integration history divergence

The reconciler reported three failed integrations of measurement reviewer head `b38f1aa2`, naming conflicts in `full-turn-replay.md`, `live-replay-capture.ts`, `live-replay-ops.ts`, `run-live-replay.mjs` and the measurement and tooling issues. Inspection with `git merge-base`, `git log --left-right` and `git log --cherry-pick --left-only` shows its common ancestor with immediate replay-tree head `ac65571f` is `a19fc3d9`. The reviewed branch contains rebased, patch-equivalent preparation and early handler commits atop enclosing-tree `6ade7159`, but lacks four later immediate-parent decision commits. Its final tracker snapshots omit the explicit review-claim rescope and earlier gate rulings. This is observed history divergence; the exact integration commands and why reconciliation failed three times were not inspected.

Workaround authorized in [[projects/concept/issues/measure-live-classical-chinese-first-turns#Integration recovery]]: preserve the reviewed packet; reconcile against the immediate parent, retain the approved outer-tree update, avoid replaying already-landed preparation, and union parent rulings with worker results. Retry the unchanged final-head gate, not the experiment. Successful recovery is not yet observed.

Recommendation for the mlegls-pi reconciler: preserve the immediate-parent base when applying enclosing-tree gate updates, and ensure conflict recovery retains handler decisions alongside worker results. Check for patch-equivalent ancestor replay before another blind integration retry. This shares the existing branch-state/delivery observation's tooling owner; it is not evidence that any particular resolution message was unread.
