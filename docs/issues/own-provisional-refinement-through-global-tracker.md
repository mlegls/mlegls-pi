---
stage: ticket
assignee: agent:technical
author: session:01a12f88-e529-7473-951d-ed4cb0f4a7c5
part-of: "[[projects/mlegls-pi/issues/reconcile-with-global-tracker-and-landing-ledger]]"
priority: 2
drive: none
---

Fill `lib/reconcile/refinement.ts`: persisted ownership, cleanup, adoption and acceptance of globally created provisional children. Keep the helper dormant until the atomic runtime cutover.

## Context and ownership

Read the enclosing ticket and fixed `Tracker`, `GlobalRunState`, `RefinementAttempt`, and `RefinementContext` seams. Existing consumers are `reconcile.ts:startPhase/launchNow/onReport/applyResolution/visit/tick`, `checkpoint.ts` and `main.ts:stop`; another child wires them. `lib/dispatch.ts:stop/integrate/retire` and `lib/thread/registry.ts` are the stop/receipt precedent. `agents/roles/refine.md` already requires children created with the supplied attempt token; no instruction edits here.

Own only `lib/reconcile/refinement.ts` and `docs/attachments/reconcile-with-global-tracker-and-landing-ledger/refinement-probe.ts` / `refinement-protocol.md`. Do not edit State, scheduler, the landing protocol, runtime launchers or retained tests. Shared types are fixed, and all writes go through Tracker.

## Literal implementation contract

- `beginRefinement` snapshots the node's original subtree identities and parent fields, generates exact `reconcile:<root>/<handle>`, and saves before launch. Attempt records are keyed by actual launch handle, not node or a guessed prefix.
- `observeRefinements` rescans current global state. Ownership is a new identity absent from that attempt's saved baseline, currently carrying its exact claim, under its node. Save new owned identities while writing, including creates that happened immediately before a crash. Mere parenthood or old observations do not authorize deletion.
- `discardRefinement` saves stopping/cleaning intent, awaits the context's exact-writer stop successfully, then rediscovers and removes only still-owned provisional descendants via Tracker.remove. Stop failure leaves ownership intact and propagates. Delete in a graph-valid sequence (descendants/dependents first where necessary); restore the saved parent residual stage through Tracker.update before removing its final child would leave an invalid omitted-stage leaf. Temporary omitted-stage provisional containers being pruned must also remain valid at each write. Do not rollback bodies, unrelated fields, pre-existing children, unrelated friction or a child whose ownership changed. Save progress so retries finish a partially published removal.
- `replaceRefinement(..., adopt:false)` stops/discards first, then begins a successor from the cleaned tracker. `adopt:true` is for an explicitly requested same-work continuation: persist successor with the original baseline and adoption relation before releasing old ownership; stop old writer; rediscover still-owned children; relabel only those claims to the successor token and save progress. The old attempt records its successor. Recovery owns both exact tokens until relabeling completes; children cannot dispatch in between. Never re-create children already removed by a failed attempt.
- `acceptRefinement` refreshes the actual global contract and validates reported direct-child slugs against its open direct children. An empty reported list is a promotion only when the node's own/effective stage is ticket. Decomposition children must be valid executable spec/ticket contracts preserving monotonic scope; reject missing/mismatched children, foreign claims and unrelated reported identities without accepting them. Preserve baseline children, but do not overwrite foreign reservations.
- Save the acceptance report/ts/children and destination before landing code. Redirect the registered worker's ab-parent to the supplied collector branch and land its committed stubs with actual integrate(keep:true); refuse tracker branch edits. Save preparedHead before merge and prove ancestry to replay a merge that completed before the next save. Both promotions and decompositions carry stubs into a collector, not directly into the owner. Only after code lands convert the attempt-owned children's claims to stable `reconcile:<root>` and mark accepted. Their original per-attempt creation ownership remains recorded for audit, not further deletion authority.
- `recoverRefinements` completes persisted cleaning/adopting/accepting operations idempotently before scheduling; accepting reports replay without relying on a fresh board message. A tracker claim conversion that happened just before a crash is recognized from the acceptance intent. `releaseRefinementClaims` clears only exact claims owned by this run on a moved-out subtree; foreign claims remain.

No Tracker.close and no completion ledger record for stubs. The completion ledger represents reviewed delivery, not decomposition preparation. Retire/delete the refinement chain only in the runtime after acceptance has been saved.

## First use and acceptance

Commit a disposable `refinement-probe.ts` invoking the actual helper with a real isolated Tracker and registered code-only shell/fixture workers (no model). Observe: claimed child creation before observation/crash; failure cleanup and parent stage restoration; protection of baseline/unowned/friction children; a stop failure that prevents removal; unadopted replacement with no leftover children; adopted successor with exact relabeled claims; and acceptance whose stub merge or claim conversions are interrupted by deterministic save/write failures, then replayed from saved state without a second merge. Record original/remaining identities, claim tokens, stub heads and commands in `refinement-protocol.md`.

Selectors/paths are checkout-local and isolated as in the enclosing ticket's first-use setup. Remove only fixture-owned resources. Run `bunx tsc --noEmit`. No new retained tests are approved.

This is `drive: none`: helper behavior is locally rehearsed, but production ownership is dormant. The enclosing join's actual-run failed/replaced/adopted refinement mode is the post-landing gate.