---
stage: done
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

## Result

13f2a09. `lib/records/store.ts` is the generic layer (`write` with tags/edges in one transaction, `select` by schema with a SQL condition, `fieldTags`/`fieldsOf`, `lastSeq`, `version`); `lib/board/store.ts` maps messages onto it. `records.db` beside the old log; cursors are records seqs (`line` too).

- Tag values: text and numbers as themselves, anything else as JSON in a BLOB (sqlite here is 3.43, no jsonb), so the type is recoverable. `tags.ord` carries the element index of an expanded scalar array, so arrays round-trip, one-element ones included. Non-object or empty `data` is one `board` tag. The real log (4908 messages) round-trips with zero diffs, not just modulo normalization.
- Board tags can't use the keys `topic`, `session`, `name`, `cwd`, `board`, `board.*` (send throws); none in the log did.
- Topic globs narrow in SQL by an index range on the literal prefix; tag expressions filter in process. All-messages read ~14ms, `mail/*` 5ms.
- A cursor past the end (a JSONL byte offset restored from an old session entry) resumes at the tail instead of replaying.
- Not in the ticket: a bridge for sessions still running the JSONL code. Before every read, lines appended to `log.jsonl` past a stored offset are imported (skipping known ids; the first sync is the full import), and `send` mirrors to `log.jsonl`. `syncLegacy` in `lib/board/store.ts`; delete it, and the mirror, once no session runs the old board.
- Smoke: a dispatched worker (new code) reported into the store and the JSONL mirror; this session (old code) got the wake and integrated it.
