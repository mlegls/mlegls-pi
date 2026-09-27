---
stage: spec
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/dsh-port]]"
blocked-by: ["[[projects/mlegls-pi/issues/dsh-hashline-tools-spike]]"]
---

Autobiographical memory (`extensions/memory`, `lib/memory.ts`) as a dsh compaction provider replacing `compaction-basic` through the `ctx.compaction` seam, triggered from `agent/pre-step` (context pressure) and `agent/request-error` (overflow). The checkpoint prompt and its register history carry over unchanged ([[projects/mlegls-pi/issues/compaction-register-variants]]), including the fallback to the native compaction when the provider filter blocks both prompts.

Differences from pi to design around:
- The model request is derived from the durable session log. Elision and memory rewrites are logged, replayable surface replacements (see `compaction-tool-result-pruner`), not a per-request `context` transform.
- There is no tree inside a session. A fork is a new session with lineage metadata and an exact inherited prefix, so memory follows lineage instead of `session_tree` branches.
- Recall of original turns across sessions: `session-query-sqlite` + `tool-session-query` (full text, filters, cursors) rather than our own index, where they suffice.
- Custom durable records are session events with `ignorable: true`, under dsh's session-format versioning.

Done when a long session in `dsh web` compacts through this provider, the continuation carries the checkpoint and verbatim tail, and a cited original turn can be recalled verbatim, including from a forked session.
