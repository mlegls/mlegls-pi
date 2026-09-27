---
stage: done
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/dsh-port]]"
---

Autobiographical memory (`extensions/memory`, `lib/memory.ts`) as a dsh compaction provider replacing `compaction-basic` through the `ctx.compaction` seam, triggered from `agent/pre-step` (context pressure) and `agent/request-error` (overflow). The checkpoint prompt and its register history carry over unchanged ([[projects/mlegls-pi/issues/compaction-register-variants]]), including the fallback to the native compaction when the provider filter blocks both prompts.

Differences from pi to design around:
- The model request is derived from the durable session log. Elision and memory rewrites are logged, replayable surface replacements (see `compaction-tool-result-pruner`), not a per-request `context` transform.
- There is no tree inside a session. A fork is a new session with lineage metadata and an exact inherited prefix, so memory follows lineage instead of `session_tree` branches.
- Recall of original turns across sessions: `session-query-sqlite` + `tool-session-query` (full text, filters, cursors) rather than our own index, where they suffice.
- Custom durable records are session events with `ignorable: true`, under dsh's session-format versioning.

Done when a long session in `dsh web` compacts through this provider, the continuation carries the checkpoint and verbatim tail, and a cited original turn can be recalled verbatim, including from a forked session.

Implementation: `dsh/memory/index.ts`, loaded by the `memory` overlay entry;
[usage](../../dsh/memory/README.md). The shared checkpoint prompt is unchanged.
Dsh allows citations to retained original turns while requiring a newly folded
source: [[projects/mlegls-pi/issues/memory-checkpoint-cites-retained-tail]].
The explicit `/compact` command remains native; pressure and overflow use memory.

Setup needs the pinned append-marker patch:
[[projects/mlegls-pi/issues/dsh-session-append-ignorable]].

First-use result: [evidence packet](../attachments/dsh-memory-compaction-provider/index.md).


Initial attempt (historical): a local low-threshold Web session compacted at
`memory/checkpoint` seq 122 and recovered a same-session source after correcting the
lookup request. One later run exposed inconsistent ID framing; `36319c6` normalized
both observed forms. At that point the fix and fork recall remained unverified. The
successful fresh rerun below supersedes that status. See
[supervised evidence](../attachments/dsh-memory-compaction-provider/index.md).


Initial supervised attempt (historical): `dsh web` selected an external default
workspace despite isolated `DSH_HOME`. Its memory citation/fork acceptance was
unverified then. The exact created `MEMORY.md` was removed. A checkout-rooted
workspace was configured before turns in the successful rerun below. The external
default-workspace behavior remains tracked in
[[projects/mlegls-pi/issues/dsh-web-default-workspace-outside-home]].

Successful fresh rerun (2026-09-27), on `36319c6`: before model turns, added and
selected a Web workspace rooted at this checkout. Provider checkpoint seq 35 cited
`session-e3b7f2c6-2ad4-4cc9-b061-2ae60818a72a:8`; continuation preserved the fact
and tail. Same-session and forked `session_event_read` calls using the public
`session-` ID both returned the original event verbatim. Fork
`session-0e3383c3-6221-4ecc-9832-6f813334ec6b` inherited the checkpoint and points
to the parent. See [updated evidence](../attachments/dsh-memory-compaction-provider/index.md).

`MEMORY.md` was model-chosen `tools.write` after the user asked it to “Remember” a
fact; neither a built-in memory contributor nor the compaction provider wrote it.
The evidence packet traces the dispatch.

Current-revision verifier rerun: after adding/selecting an owned Web workspace and lowering the trial-only pressure threshold, a real model conversation compacted through memory, continued with checkpoint and tail, then recalled the cited source exactly in-session and from a seeded fork. See [current verifier evidence](../attachments/dsh-memory-compaction-provider/index.md#current-revision-verifier-rerun-2026-09-27).

## Verification evidence

[Encounter and evidence](../attachments/dsh-memory-compaction-provider/index.md).
