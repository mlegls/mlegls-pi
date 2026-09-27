# Autobiographical compaction

The `memory` overlay entry provides `ctx.compaction`. It inherits dsh's pressure
and overflow triggers, token pricing, retry policy and durable replacement writer
from `BasicCompactionEngine`. The checkpoint prompt is the unchanged
`compaction-om-v10` prompt from `extensions/memory/core.ts`; its
[register history](../../docs/issues/compaction-register-variants.md) remains there.

The model sees the replayed conversation and chooses a balanced verbatim tail.
The prefix becomes a cited memory checkpoint. Earlier memory blocks are retained
until they exceed roughly 12,000 tokens, then rewritten into an 8,000-token budget.
A new append block has a 3,000-token target. Invalid citations, incomplete output,
changed conversation or a nonshrinking replacement leave the old surface intact.
Citations may reference the visible tail, but a checkpoint must cite at least one
newly folded original. This separates citation provenance from coverage; Pi's
folding-only validator is unchanged.
When the provider's reverse-engineering/output-duplication filter blocks the
checkpoint, retry once with the existing plain prompt; if both are blocked, use
native compaction. The explicit `/compact` command remains native.

Citations are `[@SESSION:SEQ]`. To recover an original event, including from a
fork, use the stock session query tool through PTC:

```ts
console.log(await tools.session_event_read({session_id: "SESSION", seq: 42}));
```

`session_search`, `session_event_search`, `session_trace` and
`session_event_trace` provide search, filters and lineage. These use dsh's
workspace authorization and SQLite session-query backend, not another index.

The durable `memory/checkpoint` event is log-only and explicitly ignorable. It
records schema version 1, register, blocks, operation, chosen tail and the landed
checkpoint sequence. Only records whose checkpoint remains on the current
surface apply. Forks inherit that exact prefix and keep the original session
coordinates in earlier citations. The native replacement is independently
replayable without this plugin.

Setup is `bun run --cwd dsh setup`, then the Web command in `dsh/README.md`.
This is local Web, not Cloud; compaction needs a configured model credential.
Use an isolated `DSH_HOME` for trials. The `memory` entry accepts native basic
compaction policy settings; the committed defaults reserve 8,192 tokens for
checkpoint output. A later Cordis patch replaces the entry's config, so include
all desired settings, not just the changed threshold.

The pinned session package needs a small
[append-marker patch](../../docs/issues/dsh-session-append-ignorable.md), applied
by Bun during setup. Do not omit `patchedDependencies` when integrating overlays.
