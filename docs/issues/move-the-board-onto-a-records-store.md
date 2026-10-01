---
stage: ticket
assignee: agent
author: session:01a0f631-4e97-72b6-8a26-efb5b36cdc8e
part-of: "[[projects/mlegls-pi/issues/memory-as-a-log-with-pluggable-projections]]"
---
Replace `lib/board/store.ts`'s append-only JSONL with the records store from the parent's shape (`records`, `tags`, `edges` in `bun:sqlite`, WAL), and keep the board's exported API and tool/CLI surface unchanged. Board messages are records of schema `board`.

- Mapping: `topic` → tag `topic`; `from.session|name|cwd` → tags `session`, `name`, `cwd`; board tags as-is, `k:v` split at the first colon into key/value, a bare tag has an empty value; `data`'s top-level fields → `board.<field>` tags (scalar arrays expand to rows, objects and arrays of objects are one JSON value). Reads reassemble the `Message` shape; normalizing odd JSON (null vs missing, empty objects) is accepted.
- Cursors: callers treat `logSize()`/`readFrom(offset)` offsets as opaque numbers (`wm.ts`, `children.ts`, `reconcile/reconcile.ts`, `board/host.ts`); they become the last seen rowid. `lib/tree/graph.ts` uses `logPath()`; give it whatever it needs from the db.
- `topic` globs and the tag expression language (`board/query.ts`) compile to SQL over `tags`, or filter in process over a narrowed candidate set; whichever is less code. `read` no longer reads the whole log.
- `waitFor` polls `PRAGMA data_version`.
- `reads.jsonl` (read/ack audit) can stay a file; moving it is optional.
- Import the existing `~/.local/share/pi-board/log.jsonl` once (about 4.9k messages) so live topics keep their history; message ids are preserved.

Write tags, edges and their record in one transaction. Expose the generic layer (write a record with tags/edges, query by tags) from a module the `om` schema ticket can use; it does not need edges yet beyond the table existing.

Acceptance: `lib/board/store.test.ts`, `query.test.ts` and the board/wm/children/reconcile tests pass unchanged except for cursor-as-bytes assumptions; the import round-trips every message in the current log through `read` (modulo the accepted JSON normalization); a dispatch → report → integrate cycle works against the new store.
