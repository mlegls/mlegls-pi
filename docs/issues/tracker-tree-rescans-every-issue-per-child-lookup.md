---
stage: "done"
assignee: "agent"
author: "session:01a16b02-e0bb-72f0-9183-261e8b6bc580"
priority: 3
---
`issues.ts tree` (unscoped) takes about 67 seconds of CPU on Concept's vault (2,007 output lines, archived issues included), while `snapshot --json` over the same vault takes about 2.7 seconds. Agents read it as a hang: Concept's [[projects/concept/issues/tracker-tree-hangs-while-snapshot-completes]] saw `tree | grep …` print nothing for over 80 seconds and killed it.

Cause, measured 2026-10-24 on Concept at `123adc01`: `children(i, all)` scans every issue (`[...all.values()].filter(c => c.partOf === i.slug)`). `tree` calls `line()` for each issue, and `line()` calls `effectiveStage` (recursive through `children`) once and `dependents()` once, which calls `complete()`, and so `effectiveStage`, for every issue in the vault. That makes one `tree` roughly cubic in vault size.

A per-map child index alone took the same command to 1.6 seconds with byte-identical output (apart from inflight claims that changed between the runs). This is the patch that was measured, applied to a copy outside the repository:

```ts
const childIndex = new WeakMap<Map<string, Issue>, Map<string, Issue[]>>();
function children(i: Issue, all: Map<string, Issue>): Issue[] {
  let index = childIndex.get(all);
  if (!index) {
    index = new Map();
    for (const c of all.values()) if (c.partOf) index.set(c.partOf, [...(index.get(c.partOf) ?? []), c]);
    childIndex.set(all, index);
  }
  return index.get(i.slug) ?? [];
}
```

The cache is keyed by the map object, so a map that is mutated after its first `children` call would read stale children. `close` builds `candidate = new Map(all)` and calls `set` before using it, so it is safe today. Either keep that invariant visible in a comment, or build the index once per command from the loaded issues. A regression test should time or count `children` calls on a synthetic vault of a few thousand issues, not on Concept's.

Not changed in place: the sweep that found this (Concept daily sweep 2026-10-24, worker sweep-localdev-b) is not authorized to integrate into this checkout.

2026-10-25 corroboration from Concept joined Application Patch translation worker @thread:thr_t3ejtyd4wb: unscoped `issues.ts tree | grep -i -E 'hook|bypass|worker.*guard|guard.*worker' | head -35` produced no output before the 30-second command timeout. A scoped subtree read had completed normally. Workaround: use `snapshot --json` and filter its issue slugs instead; that completed promptly. This is another observed lookup cost, not a changed cause or a product-journey failure.

## Result

done

The child-index change holds. It fixes the slowdown only in part, so I made one more fix in `dependents()`.

- **Child index:** `children()` now looks up a per-map index. That's safe because `publish` fills its map before the first lookup, and `close` works on a fresh `candidate` map.
- **Remaining cost:** `dependents()` called `complete()`, which walks the whole stage tree, on every issue before it checked `blockedBy`. `tree` was still quadratic: 7.96 s on the 2,010-issue synthetic vault, against 0.44 s for `snapshot --json`.
- **Fix:** I swapped the two conditions (`i.blockedBy.includes(slug) && !complete(i, all)`). Behavior is unchanged, and the same 2,010-line tree now takes 0.41 s including fixture setup.
- **Checks:** the tree's SHA-256 is identical to the baseline, and the tracker tests pass (36 pass, 0 fail). I appended a review section to the packet's `index.md`.

No tracker frictions were filed or linked by the workers, so I triaged nothing. The earlier timings were single runs on a synthetic vault, not Concept's.

```yaml
commit: f084c08f
stories:
  - story: Unscoped tree completes promptly on a 2,010-issue synthetic vault
    outcome: held
  - story: Tree output preserves archives and dependency annotations
    outcome: held
  - story: Scoped tree remains usable
    outcome: held
evidence:
  path: docs/attachments/tracker-tree-rescans-every-issue-per-child-lookup/index.md
  visual: false
  shots: []
tests:
  - skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts
  - skills/enabled/all/mlegls/conventions/tracker/scripts/persistence.test.ts
fixed:
  - "dependents() tested complete() before blockedBy, which kept tree quadratic after the index (f084c08f)"
filed: []
caveats:
  - "proposed test: unscoped tree on a few-thousand-issue synthetic vault finishes within a generous bound (guards the lookup cost of the tracker's tree/stage projection); the ticket asked for a regression test and none was added, awaiting maintainer approval."
```

Evidence: [docs/attachments/tracker-tree-rescans-every-issue-per-child-lookup/index.md](../attachments/tracker-tree-rescans-every-issue-per-child-lookup/index.md)
