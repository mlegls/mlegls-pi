# Provisional refinement protocol first use

## Setup and entry

Required target: an isolated checkout-local global vault, board, registry and code-only fixture workers; no model or production cutover. Prepared target: a fresh owned /tmp/refinement-probe-* repository, main owner checkout, sparse collector checkout and sparse registered worker checkouts. Persona/provenance: user:fixture; no credentials.

Run from the package checkout:

    bun docs/attachments/reconcile-with-global-tracker-and-landing-ledger/refinement-probe.ts

Or from any cwd:

    bun /absolute/path/to/mlegls-pi/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/refinement-probe.ts

The script exports refinementProbe() for the enclosing rehearsal entry. It builds and removes only its mkdtemp fixture, restores the inherited environment, clears inherited BB/session/runtime identities, and supplies isolated XDG_STATE_HOME, PI_BOARD_DIR, PI_CODING_AGENT_DIR, ZMX_DIR and TRACKER_VAULT. TRACKER_CLI and PI_AGENT_PROMPTS_DIR resolve from the script's checkout; AB_THREAD_RUNTIME=zmx and MISE_TRUSTED_CONFIG_PATHS select fixture-owned state.

Readiness was observed through the real getTracker(..., {inflight:false}) snapshots and git worktree/registry operations. Workers are registered committed-code fixtures, not paid agents or a seeded scheduler. No server, model, browser, daemon or worker process is launched. The real dispatch.stop and integrate(keep:true) paths are invoked; fixtures start with an intentionally wrong main ab-parent, which acceptance redirects to the checked-out collector branch.

## Observed transitions

All rows below use actual Tracker writes and snapshots. The script fails if the stated transitions do not occur, prints selected identities/claims and prepared code heads as RESULT, then removes the fixture. Failures are deliberately injected after successful tracker publication or before state-file replacement, followed by a reload from the saved file. No report is re-sent for recovery.

| Criterion | Action and observation |
| --- | --- |
| Creates before observation/crash | cleanup-first's saved baseline was [cleanup], owned was empty. It created container, leaf and dependent with reconcile:fixture/cleanup-first, then the state was reloaded without observing. Discard rediscovered and durably recorded all three before pruning. |
| Graph-valid cleanup and residual restoration | cleanup and container both omitted stage. dependent blocked on leaf. Removal published dependent first, then set container stage to spec before removing leaf, then restored cleanup's saved spec before removing container. A failure immediately after removing dependent was replayed. Only cleanup remained; its changed priority 3 and sharpened body survived. The original creation identities stayed in the attempt's owned audit list. |
| Baseline/unowned/friction protection | protected-first's baseline included baseline. Even after baseline acquired the exact attempt token it survived. New unowned had no claim; changed-owner was observed with the attempt token then changed to session:foreign; outside friction remained an idea. All four survived, while only owned was removed. |
| Stop failure prohibits removal | Exact writer stop failed for protected-first. owned still existed with reconcile:fixture/protected-first and the attempt remained stopping. After reload, successful exact-worker stop allowed recovery to remove owned. No deletion preceded successful stop. |
| Unadopted replacement | replace-first created discarded and omitted the parent stage. replaceRefinement(..., false) removed discarded, restored spec, and began replace-second with cleaned baseline [replace], empty owned, and reconcile:fixture/replace-second. Old record was removed with successor recorded. |
| Explicit adoption | adopt-first created adopt-a/adopt-b with its exact token; already-pruned was removed before replacement. Successor adopt-second was saved adopting with the original [adopt] baseline and adoptedFrom before old stop. An after-write failure left adopt-a using the successor token and adopt-b the predecessor token. Recovery stopped the predecessor again, relabeled only the still-owned child, and saved old removed/new writing. Both remaining children used reconcile:fixture/adopt-second; already-pruned never returned. |
| Global acceptance validation | A missing reported child and a foreign reservation were rejected before accepting intent. Decomposition reported exactly existing-part/part-a/part-b. existing-part was in the baseline and stayed unclaimed; new ticket part-a and spec part-b (blocked by part-a) retained scope and executable stage. Empty spec report was rejected; promotion succeeded only after Tracker changed promote to ticket. |
| Merge-before-save replay | Acceptance saved worker, report/ts, children, collector destination and preparedHead. Real integrate landed the stub, then saving landedHead failed. Reload still had accepting + preparedHead, without landedHead. Recovery proved preparedHead was an ancestor of collector HEAD and did not integrate again. |
| Interrupted claim conversion | Recovery's update of part-a published reconcile:fixture, then threw. part-b still carried reconcile:fixture/decompose-first. Discard was refused during that partial stable conversion. Recovery converted part-b; the final accepted save then failed. Reload recognized both stable claims from the acceptance intent and completed accepted without another merge. Creation ownership remained recorded, but did not authorize deleting stable reservations. |
| Promotions land stubs too | promote-first's committed stub reached the collector and its attempt was accepted with children []. The owner main checkout did not have the stub. |
| Tracker-edit refusal and failed acceptance cleanup | A registered worker branch edited docs/issues/refusal.md. Acceptance refused it and collector HEAD did not change. With no stable conversions published, unadopted replacement stopped that writer, removed refusal-child, and created a clean successor. |
| Move-out releases exact run claims | releaseRefinementClaims(decompose) cleared part-a's stable run claim, left part-b's newly foreign session:foreign reservation, and did not close either issue. |

No Tracker.close, completion ledger entry or worker retirement is performed by stub acceptance. The ledger remained empty and globally stored issues remained open.

## Runtime seam

The helper is dormant: this change modifies no production caller, State, scheduler, landing protocol or instruction. beginRefinement, observeRefinements and releaseRefinementClaims are synchronous. The async discard/replace/accept/recover operations acquire context.locked internally; callers must not nest that same non-reentrant lock.

The runtime must persist each actual launch handle before launching, supply its exact token, observe while writing, recover pending operations before scheduling, withhold provisional/adopting/accepting children, and retire the refinement chain only after accepted is saved. Removed/accepted attempt records retain creation identities for audit, not deletion permission. Once stable conversion starts, recovery finishes acceptance before replacement; pre-conversion acceptance failures can still discard/adopt.

Deletion blocked by a protected child/dependent fails closed rather than detaching, deleting or rewriting that unrelated contract. Current exact claim plus original-baseline exclusion is authority, not the owned history alone.

The enclosing atomic-runtime join and its failed/replaced/adopted actual-run modes remain the post-landing gate. This local helper rehearsal is not evidence that the production scheduler has been activated.

## Checks and final observed code heads

The final replay was run from /tmp, then bunx tsc --noEmit completed successfully. The existing checkpoint/stop checks also passed: 2 tests, 29 assertions.

    bunx tsc --noEmit
    bun test lib/reconcile/checkpoint.test.ts lib/reconcile/stop.test.ts

No new retained tests or changed retained assertions.

Exercised source revision: 8be1197 (the following packet commit changes documentation only). Final replay target was /private/tmp/refinement-probe-GAwOSY/repo, with its collector and workers under that same owned fixture root; it was removed on completion.

- Collector before decomposition: ca8365ad50a19825d6f501132f72c01cd5017ecf.
- Committed decomposition stub / saved preparedHead / post-merge collector HEAD: 347f096e57f32c1923e1ecf988ff8b8484c5d53d.
- Collector HEAD after every decomposition replay: the same 347f096e57f32c1923e1ecf988ff8b8484c5d53d (no second merge).
- Promotion preparedHead / collector HEAD: cad92be2a3927a03c94d83fbc153e4c6873f0aeb; ownerHasStub was false.

Fixture commit hashes vary on rerun because commit timestamps are real; the ancestry and no-second-merge assertions are the stable criterion.
