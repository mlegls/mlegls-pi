---
stage: "ready"
assignee: "agent"
priority: 2
author: "session:thr_rcfdcp7u7t"
---
The refiner writes children into the live tracker while it works, each carrying a provisional `claimed-by: reconcile:<root>/<refine-handle>`, and [refinement.ts](../../lib/reconcile/refinement.ts) (372 lines) keeps a baseline of the original subtree so it can discard, adopt or replace those writes when the attempt is stopped, retried or crashes. The 2026-11-23 orchestration audit (@thread:thr_3pkhxrd57p): "The refinement token engine, a complex 371-LOC module with a compensating rollback state machine, could be significantly streamlined by having the refiner propose child specs, which the reconciler creates atomically. This approach would simplify reconciliation logic, reduce reliance on claim tokens, and eliminate race conditions." It matters most in Concept, which ran 138 of the 145 historical refinements; mlegls-pi ran 7.

## shape

- The refiner doesn't write the tracker. It proposes the result in its branch: one file per new child in tracker vault format (frontmatter + body), plus the parent's promotion (`decompose: false` and any `## tasks` body) when it promotes, alongside any interface code it commits. The handoff names them. Choose the exact location and format; it has to work for the GitHub tracker too, so the reconciler reads the proposals and writes them through `Tracker`, never by merging issue files.
- On acceptance, the reconciler, under its tracker lock, validates the proposal (same rules as now: children `stage: ready` and agent-assigned, `part-of` the refined node), lands the interface commit without the proposal files, then creates the children with the stable `claimed-by: reconcile:<root>` and applies the parent change. Creation is idempotent by slug, so replaying an interrupted acceptance creates only what is missing.
- Discard, stop, retry and adoption no longer touch the tracker: an unaccepted attempt has written nothing there. Delete the provisional-claim, baseline and cleanup machinery that this makes dead (`discard`, `adopt`, `replaceRefinement` token transfer, `releaseRefinementClaims`, `observeRefinements`) and its callers in [reconcile.ts](../../lib/reconcile/reconcile.ts).
- Update [refine.md](../../agents/roles/refine.md) to the new contract.
- Running reconcilers restart onto this code when it lands (code fingerprint). A refinement attempt saved under the old protocol, with provisional children already in the tracker, must still finish or be discarded correctly after that restart: keep a narrow legacy path for those attempts, or show none exist in Concept's and mlegls-pi's run state when this lands.

## check

An offline replay against a real vault tracker (pattern: other `docs/attachments/*/replay.ts`): a refine worker proposes two children and an interface commit; before acceptance the tracker has neither child; the reconciler is SIGKILLed after creating the first child and restarted; afterwards both children exist exactly once with `claimed-by: reconcile:<root>`, the interface commit is on the collector, and no proposal file landed. A stopped attempt leaves the tracker byte-identical. A promotion sets `decompose: false` and goes to implement as before. refinement.ts is substantially smaller.
