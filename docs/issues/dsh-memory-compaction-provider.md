---
stage: spec
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

Fresh supervised encounter (2026-09-27): local Web with a low-threshold trial
overlay compacted a padded session. Durable `memory/checkpoint` seq 122 preserved
a citation to original event 8; continuation answered the early facts, and a
same-session `session_event_read` returned the source text verbatim after an
initial explicit-ID attempt failed. The fork journey remains unverified. The
encounter exposed inconsistent `session.id` framing: one session's checkpoint
references omitted the public `session-` prefix; a later session produced a
`session-session-` prefix. `dsh/memory/index.ts` now normalizes both forms, but a
memory checkpoint with the normalized citations has not yet been observed. See
[supervised evidence](../attachments/dsh-memory-compaction-provider/index.md).

Setup friction: `dsh web` used an external default workspace despite isolated
`DSH_HOME`; a model turn created one unrequested `MEMORY.md` there. That exact new
file was removed. The owned-target preparation gap is recorded in
[[projects/mlegls-pi/issues/dsh-web-default-workspace-outside-home]]. Do not resume
agent turns until the Web workspace is checkout-owned.
and verbatim tail, and recalled a cited original from the parent and a fork.
Both final sessions reloaded. Fresh supervised verification remains.
