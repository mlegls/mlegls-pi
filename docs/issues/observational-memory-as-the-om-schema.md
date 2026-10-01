---
stage: ticket
assignee: agent
author: session:01a0f631-4e97-72b6-8a26-efb5b36cdc8e
part-of: "[[projects/mlegls-pi/issues/memory-as-a-log-with-pluggable-projections]]"
blocked-by: ["[[projects/mlegls-pi/issues/move-the-board-onto-a-records-store]]"]
---
Replicate pi-observational-memory (installed: `~/.pi/agent/npm/node_modules/pi-observational-memory`, 3.1.4) as the `om` schema over the records store, in `extensions/context`, as closely as possible: same observer/reflector/dropper prompts and cadence, same settings under `observational-memory`, same rendered compaction summary, same `recall` and `/om:*` surfaces. The point is exercising the architecture, not changing memory behavior.

- Vendor the prompts, `serialize.ts` and the agent loop shape with MIT attribution. Replace `session-ledger/*`'s reads and writes with the store.
- Observations: records of schema `om`, tags `session`, `om.relevance`, `om.tokens`, `ts` from the message time; `cites` edges to `entry:<session>/<entry>` for `sourceEntryIds`. Reflections: records with `reflects` edges to their supporting observations. Drops: edge records `drops`. `coversUpToId` becomes the projector's cursor.
- Branches: the interactive render keeps only records whose cited entries are ancestors of the current tip (OM gets this from living in the session file).
- pi's compaction `details` still receive the folded snapshot.
- Then remove `npm:pi-observational-memory` from `~/.pi/agent/settings.json` (not managed by system-config). Existing sessions' OM ledgers are not migrated.

Acceptance: run upstream OM and the port over the same recorded session ledger (feed the port the same observer/reflector outputs so the comparison is deterministic) and diff the rendered compaction summary: identical. Then one real long session compacts through the port, and `recall` on a rendered id reaches its source entries.
