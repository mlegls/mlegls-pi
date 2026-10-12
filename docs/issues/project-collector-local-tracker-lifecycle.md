---
stage: ticket
assignee: agent:technical
author: session:01a12f88-e529-7473-951d-ed4cb0f4a7c5
part-of: "[[projects/mlegls-pi/issues/reconcile-with-global-tracker-and-landing-ledger]]"
priority: 2
drive: none
---

Implement the private collector scheduling projection in the committed stub `lib/reconcile/scheduling.ts`. Preserve the canonical CLI model; do not activate it in the reconciler yet.

## Context and ownership

Read the enclosing ticket and `lib/tracker.ts`, `lib/reconcile/tracker-state.ts`, `lib/reconcile/scheduling.ts`. Algorithm precedent is `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts`: `children`, `effectiveStage`, `complete`, `subtree`, `model`, `openBlockers` (lines 323–372 at refinement). The DTO carries raw `blockedBy` and `guards`; the existing CLI JSON additionally emits a rolled-up `blockers` field not declared by `lib/tracker.ts`. Do not use that rollup as input. `lib/reconcile/reconcile.ts:visit/why/tick` are the eventual consumer, owned by [[projects/mlegls-pi/issues/activate-global-reconcile-runtime]].

Own only `lib/reconcile/scheduling.ts` and `docs/attachments/reconcile-with-global-tracker-and-landing-ledger/projection-probe.ts` / `projection.md`. The shared types are already fixed; no runtime, CLI model, instruction or retained-test edits.

## Literal implementation contract

- `schedulingView(global, context)` returns new rows without modifying any input. Inherited `done`, `ownStage` and raw relations keep their canonical meanings. `satisfied` is the scheduling-only completion flag.
- Seed local completion with globally done/archived rows and entries whose `landed[slug].into === context.into`. Resolve effective stages recursively using those as neutral done, otherwise ownStage plus live children, in the CLI's stage order. Own-done parents with unsatisfied children remain unsatisfied. Omitted residual stage contributes neutral done, not a ticket assignment. Do not infer a landing from branch files.
- Rebuild remaining nodes, residual selectors, readiness, agent eligibility, deferred scope and frontier for every row as the CLI model does. Rebuild open blockers from raw issue relations and guards; missing issues and guards stay open. Internal edges do not block the enclosing scope but still block each dependent's own selection. Evaluate blocker satisfaction in this exact context, including nodes outside the selected subtree; a different collector's landing cannot satisfy it.
- Obtain stored own claims from each row's claim entries with that row's slug, then aggregate through the live subtree, including locally satisfied children, as the CLI does for stored claims. Ignore only exact `reconcile:<root>` and tokens supplied by `attemptClaims`; foreign claims, including an unrecorded lookalike token, still block. Do not filter away raw guards just because they contain a slug.
- `withheld` identifies not-yet-accepted descendants. Set `provisional` on those rows and suppress selection of any scope containing them, even though its attempt claim belongs to this run. They remain unsatisfied; neither early creation nor the refiner's ticket promotion releases them. Satisfied nodes contribute no remaining assignment constraint; foreign stored claims still reserve scopes containing them.
- Preserve explicit-scope deferral behavior via `context.explicit`. Move-out decisions remain the runtime's responsibility; project the graph supplied, not a second move-out registry.

## First use and acceptance

Commit a disposable `projection-probe.ts` (ordinary Bun script, not a test-suite import) that constructs DTO rows and calls the actual helper for two collectors and the owner path. Compare the empty-overlay output's stage/readiness/eligibility/frontier/blockers/claims/selectors with the actual CLI projection of the same isolated seeded vault. Then show a landed a releases b only in their collector; outside blocked-by a stays blocked in the owner context. Include an omitted-stage parent with a locally landed child, foreign claim, opaque guard, human residual, priority-4 scope and a withheld claimed child so the remaining rollups are observable. Print the relevant rows and input-immutability result; record commands and observations in `projection.md`.

Use checkout-local CLI paths derived from `import.meta.dir`, isolated tracker/board/state selectors and explicit author provenance for any seed writes; own and delete only the temporary vault. No models or credentials. Run `bunx tsc --noEmit`.

This is `drive: none` because production selection is deliberately dormant. The post-landing gate is the enclosing ticket's join using the actual scheduler's ledger rehearsal, after atomic activation; the module probe establishes only the helper's contract. Name that limit in the handoff. No new retained tests are approved.