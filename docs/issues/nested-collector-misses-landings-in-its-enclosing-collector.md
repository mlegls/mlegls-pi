---
stage: "ticket"
assignee: "agent:technical"
author: "session:thr_ihbpyrp6s2"
priority: 2
---

A nested collector never sees prerequisites that land in its enclosing collector after it was cut, so its dependents stay blocked and the reconciler stops. This regresses [[projects/mlegls-pi/issues/tree-collector-does-not-see-blockers-resolved-on-main]], whose catch-up merge (fabb1e8) was keyed to blockers being **done in the parent branch's tracker files**. Under the global-ledger scheduling projection, a landing records `landed[slug].into` = the collector it landed in, and `schedulingView` satisfies a blocker only when `into === context.into` ([[projects/mlegls-pi/issues/project-collector-local-tracker-lifecycle]]). A landing into the root collector therefore satisfies nothing in a sub-collector, and the tracker file is never marked done there, so the old catch-up trigger doesn't fire either.

## Observed

Concept, 2026-11-07, root `release-the-open-local-product`. `define-the-local-profile-directory-and-host-interface`, `export-a-web-profile-to-the-local-host`, `import-a-local-profile-into-the-web`, `connect-the-local-host-to-the-hub` and `learn-in-pi-with-the-mmon-extension` all landed in `tree/release-the-open-local-product`. Five dependents under sub-collectors `tree/ship-theory-migrations-with-the-theory` and `tree/measure-local-product-segments` were reported `blocked by … (not satisfied at this destination)` (`lib/reconcile/reconcile.ts` `why`, ~line 1276), and the run finished `stuck` twice. The sub-collectors lacked 45 and 28 of the root collector's commits. A hand merge of the root collector into both (d007c1205, 28d452d4b; both clean) plus a restart launched the dependents immediately. That shows the branches were the only obstacle, but the hand merge itself did not satisfy the ledger check. Either the restart re-evaluates differently, or the projection has another path. Establish which before changing anything.

## Want

When a blocker of an open node in a nested collector has landed into any ancestor destination of that collector (the enclosing collector chain up to the owner's checkout), the reconciler merges the parent branch into the sub-collector under the integration lock, parents before children, and treats the blocker as satisfied there. A conflicting merge aborts and raises to the owner with the conflicted files, as the fabb1e8 path does. A landing into a sibling or unrelated collector still doesn't satisfy it.

## Acceptance

- A scratch tracker with root collector R and sub-collector S, where S's child c is blocked-by b (a child of R, outside S): landing b into R makes the next tick merge R into S and launch c, with no hand merge or restart.
- The same with a conflicting change aborts the merge and raises one owner exception naming the files; `retry` after a hand merge resumes.
- A landing of b into a sibling collector T leaves c blocked.
- Covered by retained tests at the scheduling/catch-up layer, beside the existing collector tests.
