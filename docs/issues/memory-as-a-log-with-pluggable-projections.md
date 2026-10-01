---
stage: idea
assignee: human
author: session:01a0f549-cfd2-755e-886e-463dcd75e5f8
---

Looking at connectome, pi-observational-memory, the autobiographical memory log and [OptMem](https://github.com/VictorTaelin/OptMem), a memory system they could all be expressed in:

> there's an sqlite db with a schema like
>
> memories: id, content, parent, session, author (system)
> tags: tag, memory
>
> so either a background model writes them like in OM, or the main model, either via a tool throughout the session (or in the bg like connectome), or all at once at compaction time
>
> memories can be folded into parents. this represents supercession, abstraction, or duplication. parents can be expanded into children, and only parentless memories are ever directly used as compacted context
>
> by default, compacted context is memories of the same session, but you could also do queries by tag

Then refined: memories don't have edges. "Supersession is still an abstraction in this sense, bc the superseded memory didn't unhappen. it was superseded 'in some sense'." So memories are an immutable log (event sourcing), each with citations into its session's transcript (as the memory log's `[@entry-id]`), so expand reaches the original turns. Everything above it (supersession, folds, tag views) is a projection maintained by a pluggable projector, as a rebuildable cache, the way OptMem treats its summary tree. "Abstracting is pluggable too then; it could be the same call as memory writing or not, and there could be different abstraction systems going on in parallel." A renderer picks a cut through one or more projections under a budget.

| system | writer | projector | renderer |
|---|---|---|---|
| pi-observational-memory | background observer over turns | reflector condenses observations past a threshold | all observations and reflections, tiered |
| OptMem | the main model, `note` tool, during the session | binary segment tree over the log; merges come due by count | cut that decays with age, `WAKE_LINES` budget |
| memory log (prototype) | the main model at compaction, one shot, cited prose | rewrite consolidates blocks | blocks, then a verbatim tail |
| connectome | the session's own model, autobiographical | `kv-stable` folding | compiled view: recent verbatim, older as memories |

Tag views: a segment tree per tag over that tag's members in time order, nodes keyed (tag, lo, hi), folded lazily when a reader asks for a tag over budget. That makes them incremental and reusable across sessions without a single parent hierarchy.

Cache: render oldest and coarsest first, newest last; merges then mostly touch the young end (binary-counter carries), and a projector advances its cursor only at compaction events, so between them the prefix is stable. A cache read is about 0.1× uncached input, so one rebuild per compaction is noise; only continuous background rewriting of early context costs.

Role strategies for non-interactive agents: implement keeps decisions and file facts and supersedes often; drive's first-use log is evidence, pinned and never folded; review keeps findings; a reconciler handler reads memories tagged `node:<slug>` instead of resuming a session ([[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]]). Compacting with the role's strategy could replace the worker fence's checkpoint-and-respawn; `extensions/context` already separates that policy from the mechanism.

The board is nearly the same schema minus projections (id, body, tags like `decision` and `path:<file>`, authoring session); whether it becomes one writer into the store, or the store the board plus projections, is open.

Prior art: Mem0 (ADD/UPDATE/DELETE), Zep/Graphiti (bi-temporal invalidation), RAPTOR and MemTree (summary trees), MemWalker and ReadAgent (navigating and expanding gists), A-MEM, Letta's sleep-time compute, Mastra's Observational Memory, tree cut models (Li & Abe) for budgeted cuts.

After the v2 cutover; until then pi-observational-memory is the mechanism.
