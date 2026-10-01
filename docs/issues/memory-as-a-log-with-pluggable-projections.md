---
stage: spec
assignee: agent
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

## Decisions

2026-10-01, shaping session (session:01a0f631-4e97-72b6-8a26-efb5b36cdc8e):

- Abstractions are rows, not a cache. "Rebuildable" doesn't hold for model-written abstractions: rebuilding re-spends and changes the text under anything that cites it. An abstraction is a derivation (Nix sense): output of a projector over input ids, recorded with what it cites. What stays pure and cheap is the cut a renderer takes. pi-observational-memory V3 already works this way inside one session: `om.reflections.recorded` carries `supportingObservationIds`, `om.observations.dropped` "removes observations from active memory, not ledger history", `session-ledger/projection.ts` is a pure fold.
- Nothing mutates. An edge is itself a record (its own ts, schema, tags), so "A supersedes B" judged later is a new row, and retracting is another one (Datomic's accrete-only rule). Edges point from newer to older.
- `rel` is free text owned by the record's schema. Schema is what a record means and which projectors/renderers read it (OM, connectome, autobiographical, board). OM's edges are `reflects` and `drops`. A renderer ignores schemas it doesn't read; a shared `supersedes` is just a schema others opt into. Parallel abstraction systems are different schemas over the same rows. Prior art for the whole shape is ATProto: lexicon = schema, firehose = board pubsub, AppView = projector, labels = tags.
- No author column. Author meant context ("the perspective it's written from"), not model, and context is multi-valued: a drive worker's evidence is `session:abc`, `node:<slug>` and `project:mlegls-pi` at once. Contexts are tags. Which process or model wrote a record is provenance, in its own tags.
- The db schema is for query efficiency; any other representation is rendered on top. Tags and edges are relational, committed atomically with their record. Tags are written only with their record; classifying an old record later is an edge record. So tag order is record time.
- A schema's top-level fields are flat and become tags, namespaced with dots (`om.relevance`). Unprefixed keys are shared vocabulary (`session`, `project`, `topic`, `path`, `decision`). A value may be JSON (an object, or an array of objects such as a review's `blocking` findings); a top-level array of scalars expands to one row per element. A hot nested path gets a partial expression index, not a schema change.
- The board becomes the same store: a board message is a record of schema `board`, its topic a `topic` tag (globs stay as query sugar), its `from` and `data` fields tags. Board tools keep their surface.
- Interactive rendering by default shows a record only if the transcript entries it cites are ancestors of the current branch tip. Non-interactive reads (e.g. `node:<slug>`) ignore branches.
- First version replicates pi-observational-memory as closely as possible, as the `om` schema, so the architecture is exercised before memory behavior changes. Projectors run in-session as OM's do, keeping their position as a cursor. Then drop `npm:pi-observational-memory` from settings; sessions' existing OM ledgers are left alone, as OM did with V2.
- Not upstream: the parts worth sending are the parts this replaces. Of OM's ~4.7k lines, the prompts (~250), `serialize.ts` (~270) and the agent loop shape (~840) are kept (MIT, vendored with attribution); the ledger, projection, progress clocks, triggers and recall (~2.3k) are what the store, cursors and a generic expand replace.

## Shape

```
records(id, ts, schema, body)              -- body is the one FTS column
tags(record, key, value)                   -- value untyped (ints compare as ints) or JSON; idx (key, value, record), (record)
edges(record, src, rel, dst)               -- record → records.id; dst is a record id or an external ref like entry:<session>/<entry>
                                           -- idx (src, rel), (dst, rel)
```

`bun:sqlite`, WAL, one file beside the board's current `log.jsonl`. Waiting polls `PRAGMA data_version` instead of file size.

## Children

1. [[projects/mlegls-pi/issues/move-the-board-onto-a-records-store]]
2. [[projects/mlegls-pi/issues/observational-memory-as-the-om-schema]], after 1.
3. [[projects/mlegls-pi/issues/renderers-over-the-records-store]], after 2.

Later, once both exist: tag views (a segment tree per tag, nodes keyed by member hash since edge-tags arrive in tagging order), role strategies for non-interactive agents, and a reconciler handler reading `node:<slug>`.
