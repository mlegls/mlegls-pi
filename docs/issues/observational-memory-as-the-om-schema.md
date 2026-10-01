---
stage: done
assignee: agent
author: session:01a0f631-4e97-72b6-8a26-efb5b36cdc8e
part-of: "[[projects/mlegls-pi/issues/memory-as-a-log-with-pluggable-projections]]"
---
Replicate pi-observational-memory (installed: `~/.pi/agent/npm/node_modules/pi-observational-memory`, 3.1.4) as the `om` schema over the records store, in `extensions/context`, as closely as possible: same observer/reflector/dropper prompts and cadence, same settings under `observational-memory`, same rendered compaction summary, same `recall` and `/om:*` surfaces. The point is exercising the architecture, not changing memory behavior.

- Vendor the prompts, `serialize.ts` and the agent loop shape with MIT attribution. Replace `session-ledger/*`'s reads and writes with the store.
- Observations: records of schema `om`, tags `session`, `om.relevance`, `om.tokens`, `ts` from the message time; `cites` edges to `entry:<session>/<entry>` for `sourceEntryIds`. Reflections: records with `reflects` edges to their supporting observations. Drops: edge records `drops`. `coversUpToId` becomes the projector's cursor.
- Branches: the interactive render keeps only records whose cited entries are ancestors of the current tip (OM gets this from living in the session file).
- pi's compaction `details` still receive the folded snapshot.
- Then remove `npm:pi-observational-memory` from `~/.pi/agent/settings.json` (not managed by system-config). Existing sessions' OM ledgers are not migrated.

Acceptance: run upstream OM and the port over the same recorded session ledger (feed the port the same observer/reflector outputs so the comparison is deterministic) and diff the rendered compaction summary: identical. Then one real long session compacts through the port, and `recall` on a rendered id reaches its source entries.

## Result

7af867f. `extensions/context/om/` is upstream's `src` (3bfe769, unmodified) plus a ledger store: `session-ledger/store.ts` writes what OM appended as custom entries as `om` records instead, and `ledgerBranch` splices them back into the branch as virtual custom entries, so upstream's fold, projection, render, status and recall run untouched over `ledgerBranch(...)` instead of `getBranch()`.

- Each record has an `at` edge to the leaf when it was written and is spliced in right after that entry, where `pi.appendEntry` would have put it. So a record shows up exactly when that entry is an ancestor of the tip, and a fork (`parentSession` chain) inherits its parent's records up to the fork point.
- Observations and reflections: one record each, body = content, tags `session`, `om.kind`, `om.id`, `om.coversUpToId`, `om.timestamp`/`om.relevance`/`om.tokenCount`; `cites` → `entry:<session>/<id>`, `reflects` → `om:<id>`. A drop batch is one record with `drops` → `om:<id>` edges. Memory ids are content hashes (they repeat), so `om:<id>` is a logical ref, not a record id. Record `ts` is write time; OM's minute timestamp stays in `om.timestamp`.
- `coversUpToId` stays a tag that the vendored progress code reads, rather than becoming a projector cursor.
- OM custom entries already in a session file pass through and still fold. So old sessions keep their memory and add new records on top, which means the ledgers didn't need migrating.
- pi-agent-core 0.99 dropped `context.systemPrompt`, so the observer, reflector and dropper send theirs as a leading system message. Upstream only works because it carries its own 0.85 copy.
- `npm:pi-observational-memory` is removed from `~/.pi/agent/settings.json`; the `observational-memory` settings are unchanged.

Acceptance:
- `session-ledger/replay-upstream.ts` replays real session files: it writes their OM entries to a scratch store, strips them, and compares against upstream reading the originals. Over all 88 local sessions with drops: 307 compactions with render and details identical (including the details pi actually stored), plus coverage markers, token clocks, fold, and 25,584 recalls. Zero diffs.
- In 82 compactions pi had cut at an OM custom entry. The replay keeps those entries as inert placeholders. A port session has no such entries, so pi cuts at a real entry in the same place.
- Live: a pi session with small thresholds observed, reflected and compacted through the port. The session file had no `om.*` entries and the records were in the store. `recall` on a rendered id returned its user message, and `/om:status` read the ledger.
