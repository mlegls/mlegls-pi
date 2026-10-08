---
stage: ticket
assignee: agent
priority: 3
author: session:8b7a8886-119b-4cd8-bceb-d802d71a9915
---

Done: a worker the reconciler relaunches (retry, answered exception, next phase) starts from a base that contains every commit integrated into its level's collector, so a handler's recorded ruling is in its tracker. A test in `lib/reconcile` shows a handler's `docs/` commit reaching the next worker's checkout. The handler prompt says a ruling that changes what done means edits the ticket's acceptance/Stories lines. Then recheck the integration divergence below against the fix.

Observed under [[projects/concept/issues/measure-live-classical-chinese-first-turns]], verifying [[projects/concept/stories/plan]], [[projects/concept/stories/session]] and [[projects/concept/stories/meter-managed-usage]]. Owning tool/repository: mlegls-pi reconciler; related owner [[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]].

The handler committed explicit offline-packet verification scope at `9660f4d`, prohibiting further paid inference. The replacement driver returned the same request for fresh inference authorization or offline scope at `569485f`, without inspecting the packet. Its evidence index says it used the prior completed continuation handoff and preserved the ordinary blind-driver restriction against reading fixtures. `git merge-base --is-ancestor 9660f4d 569485f` exits 1: the scope decision is absent from that driver's branch. This establishes missing branch state and repeated clarification, not whether the resolution message was delivered or read.

Workaround: answer again with the complete offline scope, the exact packet entry point, and explicit permission to inspect retained experiment evidence rather than run the launcher. Record that ruling in the measurement ticket. Successful completion of the replacement audit is not yet observed.

Recommendation: ensure replacement workers receive applicable ancestor contract decisions as active setup, including authorized scope exceptions, rather than only the preceding implementer's one-shot invocation. Investigate message delivery and branch refresh before attributing a cause.

Cause, from `lib/reconcile/reconcile.ts` (2026-10-08): a handler's tracker commits are integrated into the level's collector (`:418-424`), but `startPhase` bases the next worker on the previous worker's HEAD and reads the ticket from that worker's checkout (`:287-291`). A retry, an answered exception or the next phase therefore never sees what a handler recorded. The handler's message reaches only the first relaunch, as `c.note`, which is cleared at the next phase change (`:538`, `:557`). That is the missing `9660f4d` in `569485f`.

decisions:
- 2026-10-08 base for a relaunched or next-phase worker: when the collector has advanced past the previous worker's base, merge the collector HEAD into the new worker's worktree before launch. Handler commits only touch `docs/`, so a conflict is a ticket the worker also edited; the new worker resolves it as its first step. Reading only the ticket from the collector would leave the worker's own tracker stale and move the conflict to integration.
- 2026-10-08 acceptance under a scope ruling (the section below): the handler prompt says that a ruling which changes what done means edits the ticket's acceptance/Stories lines, not only adds prose.
- 2026-10-08 integration history divergence (the last section): probably the same missing-collector-commits cause; recheck after the base fix before treating it as its own issue.

## Measurement acceptance versus product-success handoff

At reviewer head `637d157a`, the required integration gate passed, but review remained blocked after an explicit ruling to finish the measurement-only audit while preserving `plan`/`session` failures. The reviewer correctly noted that the standard handoff requires every required story row to be `held`; the scope ruling still left the ticket's Stories line and failed product rows as the apparent required claims. This is a contract mismatch, not a failed gate or an authorization to repair production.

Tried: answer that measurement completion does not require every diagnostic draw to satisfy the product stories, with failures preserved. Outcome: another exception asking for a waiver, explicit story rescope, or a separate production fix. Workaround now recorded in [[projects/concept/issues/measure-live-classical-chinese-first-turns#Review acceptance: measurement claims]]: define the three required measurement claims explicitly, retain failed/unobservable product observations separately, and keep the gate unchanged. Completion under that clarified handoff is not yet observed.

Recommendation: when an authorized diagnostic scope changes acceptance, update the required handoff claims as well as the prose ruling. A negative experiment result must remain negative; checking its capture/classification is a separate claim from the product expectation it falsifies.

## Integration history divergence

The reconciler reported three failed integrations of measurement reviewer head `b38f1aa2`, naming conflicts in `full-turn-replay.md`, `live-replay-capture.ts`, `live-replay-ops.ts`, `run-live-replay.mjs` and the measurement and tooling issues. Inspection with `git merge-base`, `git log --left-right` and `git log --cherry-pick --left-only` shows its common ancestor with immediate replay-tree head `ac65571f` is `a19fc3d9`. The reviewed branch contains rebased, patch-equivalent preparation and early handler commits atop enclosing-tree `6ade7159`, but lacks four later immediate-parent decision commits. Its final tracker snapshots omit the explicit review-claim rescope and earlier gate rulings. This is observed history divergence; the exact integration commands and why reconciliation failed three times were not inspected.

Workaround authorized in [[projects/concept/issues/measure-live-classical-chinese-first-turns#Integration recovery]]: preserve the reviewed packet; reconcile against the immediate parent, retain the approved outer-tree update, avoid replaying already-landed preparation, and union parent rulings with worker results. Retry the unchanged final-head gate, not the experiment. Successful recovery is not yet observed.

Recommendation for the mlegls-pi reconciler: preserve the immediate-parent base when applying enclosing-tree gate updates, and ensure conflict recovery retains handler decisions alongside worker results. Check for patch-equivalent ancestor replay before another blind integration retry. This shares the existing branch-state/delivery observation's tooling owner; it is not evidence that any particular resolution message was unread.

## Implementation check

`99c14ac` merges the collector into each successor before setup/launch and reads its assignment from the refreshed checkout. A conflicting merge remains for the successor's first step, with the collector's ticket supplied explicitly. `agents/roles/handle.md` now requires acceptance/Stories edits when a ruling changes done.

[First-use observations and historical divergence recheck](../attachments/replacement-drive-misses-recorded-offline-audit-scope/index.md): collector rulings reached the successor's history, setup and launch prompt; 26 affected regressions passed and root typechecking passed after the known plugin preparation workaround. The historical reviewer/collector merge still conflicts in the six reported files, but all four missing decisions and the review-claim rescope are available in its pending merge without replaying ancestor commits. Historical recovery was not completed or gated.

The explicitly approved `lib/reconcile/refresh.test.ts` regression passed: an integrated handler docs ruling reaches the successor's history, setup and launch prompt while retaining predecessor work. Its fixture/setup is committed and requires no inference. Independent story acceptance remains with the next verifier.
