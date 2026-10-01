---
stage: done
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

  Each mechanism's configuration is independent, its compaction trigger included: any active mechanism may trigger a compaction, and every active one renders into it. Renderers declare a role; two active ones with the same role are a conflict and get a warning. The old `observational-memory` key is read underneath as a fallback.

Acceptance: `replay-upstream.ts` zero diffs again; board/wm/children tests pass; a session resumed or forked delivers neither duplicates nor misses (test with two cursors on different branches); a live compaction through the composed path.

## Result

28f859e, 1779e7c.

- `lib/records/render.ts`: `Renderer<View, Found>` = `name`, `role`, `query(view)`, `cut(found, budget, view)` → `{ text, details }`. `lib/records/branch.ts`: `sessionChain`, `anchor` (`session` tag + `at` edge), `chainRecords`, `visible`, `splice`, moved out of OM's store. `lib/records/cursor.ts`: `readCursor`/`writeCursor`.
- `extensions/context/compaction.ts` owns `session_before_compact` and composes mechanisms' renderers. OM's hook is now its renderer (`omRenderer`, role `memory`). The first section's details are the compaction's details; `details.sections` appears only with more than one section.
- Role conflicts are checked at session start: within the list, across extensions (`memory:roles` on the event bus, owner = module URL, so a second copy of this package counts), and against `pi-observational-memory` in settings `packages`.
- Board delivery state (offset, pending, last 500 acked ids) is one `cursor` record, key `board`. It's written when pending or seen changes, and on shutdown. `board-cursor`/`board-seen` entries are read only when no record is visible.
- `memory.schemas.om` maps onto upstream's keys in `config.ts` (`flattenSchemaSettings`), over the legacy key. `~/.pi/agent/settings.json` was rewritten to the new layout; the pre-rewrite copy is `/tmp/settings.pre-memory.json`.

Acceptance:
- The replay, now through `render(omRenderer, ...)`: 67 sessions, 274 compactions, 19,912 recalls, 0 diffs.
- `lib/records/cursor.test.ts`: cursors on two branches of one session, plus a fork resuming as of the fork point. The full suite passes (166).
- Live: a `/tmp/om-live` session configured only by `memory.schemas.om` compacted through the composed path (`om.folded` details, no `sections`) and wrote `cursor` records. A dispatched worker on the new host code received a mail on its topic and answered `done: pong marco`; its cursor record went from pending to seen.
