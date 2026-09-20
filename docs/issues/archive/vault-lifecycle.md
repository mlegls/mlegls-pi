---
tags: [task]
next: done
priority: 1
---

Realize the lifecycle in the vault’s [[workflows]] specification: direct #question answers, discussion agenda and /record, tool-backed #do, fleeting triage, and ticket-linked implementation through archival.

2026-09-20: lib/vault.ts owns the transitions; extensions/record registers /record [note.md]. No watcher. Tool workers use wm.spawn from: summary and the model router. A linked thread is not redispatched; its ticket’s next is authoritative. Parent merges the worker, then calls vault.done(slug).

## live criteria

All results remain in ~/obsidian/mlegls-pi.md.

- #question: one direct answer from deepseek, not a grilling response.
- #triage: three untagged fleeting bullets became three two-line thread proposals: two merge proposals and one #implement. Jev classified the batch; a model wrote titles and bodies.
- #implement: created document-the-manual-vault-trigger in the note’s project, wrote ticket:: under the thread, and dispatched a real worker. Worker’s doc and archived ticket are committed here: [[projects/mlegls-pi/issues/archive/document-the-manual-vault-trigger]].
- vault.done: archived next: done ticket collapsed into one struck-through link under done. A second call returned an empty list.
- Discussion: vault skill returned agenda without writing comments. A real pi RPC session invoked /record mlegls-pi.md; it called vault.record, wrote a fable-attributed conclusion, and dropped #discuss.
- Spec: /record folded a complete spec into the thread body, preserved ticket::, and changed #to-spec to #implement before the done hook.
- #do: a real tool worker ran git rev-parse --show-toplevel and date -u. Its board artifact became "Vault lifecycle tool receipt" (dogfood note, since deleted) and a link replacing the instruction.
- Final scoped run: zero writes, zero agenda items; two existing model replies declined. Node imported and exercised the vault path; no Bun APIs remain in vault’s lib dependencies. No permanent tests added.

## interfaces

run({notes?}) returns written, declined, agenda. Explicit notes are scanned even when stamped; unresolved discussion agenda remains visible on subsequent runs. #triage consumes its trigger and does not dispatch its new proposals in the same invocation.

record(item, conclusion, {fold?, complete?}) requires the exact agenda snapshot. Folding replaces the whole block: first conclusion line is the title, later lines the body; callers preserve ticket metadata. Incomplete #to-spec retains its tag. /record only records conclusions established in the current session.

## frictions

Observed:
- Large multi-file show plus board.read hit the 16 KiB display cap; smaller reads and mapped board summaries recovered the useful content.
- Constructing a TS line containing a shell command containing single-quoted JS produced invalid TS despite write(). JSON.stringify of the inner shell command removed the extra quoting layer. No new payload API needed.
- The /record agent tried const vault = await import(...) against the injected vault binding; the named reserved-binding error helped, and renaming to V worked. It similarly tried fs. The command now explicitly describes the fold payload so the agent need not infer how to preserve title and ticket::.
- The first triage model returned a bracketed wiki-link target despite target meaning the bare destination. No note mutation occurred; normalization accepts either shape now.
- Initial RPC smoke model openai-codex/gpt-5.4 was unsupported for the account; switching to deepseek/deepseek-flash worked.
- Implementation worker observed find([glob,...]) fails deep in path.isAbsolute (find takes one glob), read().rows is an array rather than a count, and wm.capture(handle) needs a run even for an existing peer. Workarounds: one find glob with JS filtering, rows.length, and an explicit run.

Deferred: parent-session provenance in lib/wm still falls back to PI_SESSION_FILE, which can be stale inside exec; callers can pass parentSessionFile explicitly. A failed dispatch leaves the ticket/link for recovery rather than deleting side effects. Do workers are retained after reporting; parent owns merge/close. /record offers all pending vault agenda by default but only writes items discussed in its session; use a note argument to constrain it.

Proposed ergonomic improvements (not implemented): argument-shape diagnostics for find/lines; capture-by-existing-handle without requiring a previous spawn in the caller. No new payload channel.
