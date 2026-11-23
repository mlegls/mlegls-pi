---
stage: "done"
assignee: "agent:technical"
priority: 2
author: "session:thr_pgxs7mv9k9"
part-of: "[[projects/mlegls-pi/issues/refinement-creates-children-atomically-on-acceptance]]"
---
Authorize GitHub `Tracker.create` with the stable run claim `reconcile:<root>` from saved refinement acceptance, correlate create-journal replay without cross-parent alias collisions, and remove dead provisional-attempt token authority on GitHub. Part of [[projects/mlegls-pi/issues/refinement-creates-children-atomically-on-acceptance]], meeting [[projects/mlegls-pi/issues/atomic-proposal-refinement-engine]] at the shared contract in [proposal.ts](../../lib/reconcile/proposal.ts) (`369f35de`).

## shape

- In [tracker-github-write.ts](../../lib/tracker-github-write.ts), authorize `create(request)` with `claimed-by: reconcile:<root>` only when `run.refinements` contains an attempt in `phase === "accepting"` whose `acceptance` has `landedHead` reaching `acceptance.destination`'s `HEAD`, whose `fields["part-of"]` lies inside `attempt.node`'s subtree, and whose `acceptance.proposal.children` contains a child matching `request` through `resolveProposedChild(child, acceptance.created ?? {}, "reconcile:" + run.root)`. Refuse unauthorized stable creates and provisional-token creates.
- Reuse `journal.creates` in [tracker-github-write.ts](../../lib/tracker-github-write.ts) and [tracker-github-state.ts](../../lib/tracker-github-state.ts) for stable-claim creates, keying correlation on `(request.slug, parentId, claim?.claimedBy)` so two different refined parents in the same run proposing the same child alias do not collide while a lost `createIssue` response replays idempotently to the same `gh-N`.
- Delete dead provisional-attempt token authority (`attempt(run, token)`, provisional-to-stable and adoption claim transfers in `claimChange`, provisional `remove` paths) from [tracker-github-write.ts](../../lib/tracker-github-write.ts) and [tracker-github-state.ts](../../lib/tracker-github-state.ts). Leave [tracker-state.ts](../../lib/reconcile/tracker-state.ts) untouched (deprecated optional legacy fields are pruned at the parent join).
- Update [tracker-github.test.ts](../../lib/tracker-github.test.ts) to verify: authorized stable-claim create from saved `accepting` receipt and refusal of unauthorized/provisional creates; two siblings created in dependency order with the second's `blocked-by` referencing the first's returned `gh-N`; idempotent replay after a lost `createIssue` response; and identical aliases under two different refined parents in one run without journal collision.

## Result

done. The change meets the ticket as written, so I made no repairs. The only commit is the evidence index. Drive was skipped, so this review was the only pass before integration.

On the review head, `bun test lib/tracker-github.test.ts` passes (9 tests, 64 expects) and `bunx tsc --noEmit` exits 0. I also ran `lib/fixtures/github-acceptance.ts` by hand. It creates an accepted child and a replay returns the same `gh-2`. Given the provisional token `reconcile:gh-1/h1`, it refuses.

On GitHub, `tracker.remove` now always throws, and `discard` in `lib/reconcile/refinement.ts:155` still calls it. Provisional GitHub children can't exist any more, so that call should never run. Cleaning it up on the reconciler side is for the sibling ticket and the parent join.

```yaml
commit: fb9fb072
stories:
  - story: stable-claim create is authorized only from a saved accepting attempt (landedHead reaches destination HEAD, parent in the node's subtree, request equals resolveProposedChild output)
    outcome: held
  - story: unauthorized stable creates and provisional-token creates are refused
    outcome: held
  - story: two siblings in dependency order; the second's blocked-by references the first's gh-N
    outcome: held
  - story: a lost createIssue response replays idempotently to the same gh-N
    outcome: held
  - story: identical aliases under two refined parents in one run don't collide in the journal
    outcome: held
  - story: provisional authority removed from tracker-github-write/state; tracker-state.ts untouched
    outcome: held
evidence:
  path: docs/attachments/github-tracker-atomic-refinement-create/index.md
  visual: false
  shots: []
tests: [lib/tracker-github.test.ts]
filed: []
caveats:
  - drive was skipped (no declared drivePaths/renderedPaths touched); this review is the only pass before integration
  - the implementer rewrote the provisional create/cleanup test in lib/tracker-github.test.ts into the acceptance test, so its assertions changed (the ticket asked for this)
  - GitHub tracker.remove now always throws; refinement.ts discard (line 155) still calls it, but that path is unreachable on GitHub; left to the sibling ticket / parent join
  - "the create-journal key now hashes parentId; older intents are still found by the (slug, parentId, claim) filter"
```

Evidence: [docs/attachments/github-tracker-atomic-refinement-create/index.md](../attachments/github-tracker-atomic-refinement-create/index.md)
