---
stage: "ready"
assignee: "agent:technical"
priority: 2
author: "session:thr_pgxs7mv9k9"
part-of: "[[projects/mlegls-pi/issues/refinement-creates-children-atomically-on-acceptance]]"
claimed-by: "reconcile:refinement-creates-children-atomically-on-acceptance"
---
Authorize GitHub `Tracker.create` with the stable run claim `reconcile:<root>` from saved refinement acceptance, correlate create-journal replay without cross-parent alias collisions, and remove dead provisional-attempt token authority on GitHub. Part of [[projects/mlegls-pi/issues/refinement-creates-children-atomically-on-acceptance]], meeting [[projects/mlegls-pi/issues/atomic-proposal-refinement-engine]] at the shared contract in [proposal.ts](../../lib/reconcile/proposal.ts) (`369f35de`).

## shape

- In [tracker-github-write.ts](../../lib/tracker-github-write.ts), authorize `create(request)` with `claimed-by: reconcile:<root>` only when `run.refinements` contains an attempt in `phase === "accepting"` whose `acceptance` has `landedHead` reaching `acceptance.destination`'s `HEAD`, whose `fields["part-of"]` lies inside `attempt.node`'s subtree, and whose `acceptance.proposal.children` contains a child matching `request` through `resolveProposedChild(child, acceptance.created ?? {}, "reconcile:" + run.root)`. Refuse unauthorized stable creates and provisional-token creates.
- Reuse `journal.creates` in [tracker-github-write.ts](../../lib/tracker-github-write.ts) and [tracker-github-state.ts](../../lib/tracker-github-state.ts) for stable-claim creates, keying correlation on `(request.slug, parentId, claim?.claimedBy)` so two different refined parents in the same run proposing the same child alias do not collide while a lost `createIssue` response replays idempotently to the same `gh-N`.
- Delete dead provisional-attempt token authority (`attempt(run, token)`, provisional-to-stable and adoption claim transfers in `claimChange`, provisional `remove` paths) from [tracker-github-write.ts](../../lib/tracker-github-write.ts) and [tracker-github-state.ts](../../lib/tracker-github-state.ts). Leave [tracker-state.ts](../../lib/reconcile/tracker-state.ts) untouched (deprecated optional legacy fields are pruned at the parent join).
- Update [tracker-github.test.ts](../../lib/tracker-github.test.ts) to verify: authorized stable-claim create from saved `accepting` receipt and refusal of unauthorized/provisional creates; two siblings created in dependency order with the second's `blocked-by` referencing the first's returned `gh-N`; idempotent replay after a lost `createIssue` response; and identical aliases under two different refined parents in one run without journal collision.
