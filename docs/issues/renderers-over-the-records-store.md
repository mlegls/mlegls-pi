---
stage: ticket
assignee: agent
author: session:01a0f549-cfd2-755e-886e-463dcd75e5f8
part-of: "[[projects/mlegls-pi/issues/memory-as-a-log-with-pluggable-projections]]"
---
Compaction today is still OM's own pipeline over the store: `compaction-hook.ts` folds `ledgerBranch(...)` (`buildCompactionProjection`) and `render-summary.ts` prints the active set. There is no renderer in the parent's sense. OM's one render-time budget is `observationsPoolMaxTokens`: when visible observations reach it, the compaction folds in reflections and drops (a "full fold"); otherwise it keeps the stable prefix.

A renderer is a query, a cut under a budget, and a cursor. A board subscription is already one, delivered live; compaction is the same thing in batch. Still preserving OM behavior: this ticket exercises the architecture.

- Query is over schema and tags only. Topic is a `topic` tag and a glob is a match operator on it. Branch visibility is `at ∈ ancestors(tip)` across the `parentSession` chain: the ancestor set is a query parameter, not stored. Move `sessionChain` and the anchor/splice out of `om/session-ledger/store.ts` into `lib/records`.
- Cursors live in the db as records of schema `cursor` (tags `session`, `cursor.key`; `at` edge to the leaf), latest visible row per key wins, like Kafka's log-compacted `__consumer_offsets`. Accrete-only gives history, so a fork resumes its parent's cursor as of the fork point. Written on delivery or ack, never per poll.
- Board subscriptions move their cursor, pending and seen out of `board-cursor`/`board-seen` session entries into a `cursor` record; legacy entries are read when no record exists. Subscriptions themselves stay where they are.
- Compaction composes renderers. OM's renderer is `buildCompactionProjection` + `renderSummary` with `budget` = the old `observationsPoolMaxTokens`; its `details` stay the compaction's details, so OM's own readers and the replay harness see no change. No board section yet (that changes behavior; next ticket).
- Settings:

```jsonc
"memory": {
  "schemas": {
    "om": {
      "model": { "provider": "...", "id": "...", "thinking": "medium" },
      "observer":  { "afterTokens": 10000, "chunkMaxTokens": null },
      "reflector": { "afterTokens": 20000 },
      "dropper":   { "targetTokens": 10000 },
      "agent":     { "maxTurns": 16, "maxTokens": 32000 },
      "compaction": { "afterTokens": 150000, "mode": "ratio", "ratio": 0.5 },
      "budget": 20000
    }
  }
}
```

  A mechanism is active when it has an entry under `memory.schemas`, and each one's configuration is independent, its compaction trigger included: any active mechanism may trigger a compaction, and every active one renders into it. The old `observational-memory` key is read underneath as a fallback.

Acceptance: `replay-upstream.ts` zero diffs again; board/wm/children tests pass; a session resumed or forked delivers neither duplicates nor misses (test with two cursors on different branches); a live compaction through the composed path.
