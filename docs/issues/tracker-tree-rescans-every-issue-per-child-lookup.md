---
stage: "ticket"
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
