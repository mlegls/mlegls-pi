# Memory log

One-shot cited prose and reconciliation at compaction. No background model calls or separate memory database: Pi's session tree owns the blocks, original entries and branch history.

- `/compact [focus]` or `/memory fold [focus]`: append one new memory block. In the same call, the model chooses where the continuous verbatim tail begins.
- `/memory rewrite [focus]`: consolidate existing blocks and the folded suffix in one call.
- `/memory`: block count, approximate memory size, and the last chosen tail's size and rationale.
- `show(memory.recall({ids, offset?, limit?}))` in exec, or `ab memory recall ID... [--offset N] [--limit N]`: retrieve cited originals on the invocation's branch. Long text is paginated; images and reasoning are not returned. This replaces the standalone `memory_recall` tool.

Recall uses normal model-dependent output filtering: `show.raw(...)` or `ab raw ab memory recall ID` requests exact text; `show.pull` / `ab pull` recovers previously skimmed output. The library itself returns unfiltered text. Bash supplies the session file and leaf; exec retains a separate leaf for each asynchronous cell and passes it to its shells. Offline reads require explicit `sessionFile`/`leafId` or `--session FILE --leaf ID`; there is no latest-session/branch guess. Persisted session logs are required.

Memory is free prose with inline original-entry citations (`[@entry-id]`), not separate observation/reflection buckets. Prompt guidelines steer relevance and fidelity; the format does not classify facts. Coverage metadata tracks which turns were folded. Corrections name earlier blocks (or V1 claim IDs) and state exactly what changed, without invalidating unrelated material. Rewrites reconcile those corrections and keep direct source pointers, not chains of summaries.

New checkpoints use `memory-log.v2`, generated as `{"firstKeptEntryId":"source-id","tailReason":"Why this boundary","text":"Prose with [@source-id] citations.","supersedes":[]}`. The model selects one legal original-entry boundary; everything from there onward remains verbatim and in order. Memory covers only entries before it. Source IDs are validated against that covered prefix and existing memory provenance. A boundary cannot begin at a tool result. Unknown boundaries and citations into the newly retained tail reject the checkpoint, rather than silently moving the cut. Existing blocks render unchanged; no migration call is required.

## Context and cache

Normal calls contain separate stable user messages for each memory block, followed by the recent history. Appending a block leaves older block bodies and timestamps unchanged. The replaced suffix and retained tail still require processing after the cut. A rewrite intentionally invalidates the memory prefix.

The checkpoint instruction opens with a reflective, diaristic framing before the mechanics ("Now a memory is about to form... What surprised me?"). It invokes vgel's "Small Models Can Introspect, Too" and Jack Lindsey et al.'s "Emergent Introspective Awareness in Large Language Models" by name rather than restating the mechanism explanation. The references are intended as a compressed induction, not a replacement of introspection with summarization; whether they elicit the same capability is untested. Impressions are fallible and must be anchored to moments in the conversation. The prompt also identifies whether every assistant turn came from the current model (`selfAuthored`), without claiming continuity of its original processing. Details record `register: diary-refs-v2` and `selfAuthored` for comparison; alternatives and the motivation are tracked in `docs/issues/compaction-register-variants.md`.

Tail selection favors retaining the recent reasoning trajectory needed to continue work, not just isolated useful facts. This version permits only a continuous suffix, not disjoint excerpts. Each successful compaction records `tail.mode: model-contiguous`, its starting ID, estimated tokens, guidance target and model rationale. These records distinguish this policy from earlier fixed-tail compactions for later comparison; representational continuity or a felt benefit is not established by cache-hit tests.

The extension captures the latest context-hook messages, effective system prompt and active tool definitions. At compaction it appends subsequent session entries and a checkpoint instruction to that captured prefix, then makes one request through Pi's model registry using the current model, thinking level and session ID. Tools remain advertised for prefix stability, but are never executed by the memory call; any returned tool call invalidates the checkpoint.

After reload/model changes/branch switches, a compatible captured prefix may be unavailable. In that case it reconstructs context from Pi's session tree. Successful compaction details record `prefixMode: captured | reconstructed`, operation, model, latency and usage; usage is also returned to Pi. No provider-specific compaction endpoint is used, and no explicit cache-disable option is set. Actual cache hits remain provider-dependent; context-hook equality is not proof of identical provider payloads, especially with other transforming extensions.

## Settings

Global `~/.pi/agent/settings.json` and project `.pi/settings.json`, under `memory`:

```json
{
  "compaction": { "keepRecentTokens": 2000 },
  "memory": {
    "enabled": true,
    "keepRecentTokens": 2000,
    "blockTokens": 2000,
    "memoryTokens": 12000,
    "rewriteTokens": 6000,
    "maxOutputTokens": 12000
  }
}
```

Sizes except the provider output cap are approximate targets (characters/4). A fold becomes a rewrite when the existing memory reaches `memoryTokens`; a newly appended block can cross that threshold until the next fold. `rewriteTokens` is deliberately lower, leaving room for subsequent blocks. A rewrite that still exceeds `memoryTokens` is rejected. The output cap also needs room for reasoning and JSON, not just rendered memory.

Pi's ordinary automatic-compaction triggers still apply. Topic-boundary folding is explicit, with no background production. `memory.keepRecentTokens` (default 2000) now gives the model soft size guidance, not a mechanical cut or hard cap. The model may retain more or less. Native `compaction.keepRecentTokens` remains a separate eligibility gate: Pi prepares a cut before invoking extension hooks. Keep that setting small to let short conversations reach the hook; the final boundary is model-selected. If the chosen suffix leaves nothing new to fold, an append is cancelled without changing context.

Malformed JSON, invalid source/supersession IDs, interrupted/length-limited generation, tool calls and branch changes cancel compaction rather than falling back to a lossy native summary. The prior context is retained. Failed-generation spend is not recorded in a successful compaction entry.

## Switching backends

The package loads this extension instead of Connectome. Do not also load Connectome or observational-memory compaction hooks. Existing Connectome stores are untouched; named lives and `PI_CONNECTOME` routing are not implemented here. Use a new session for the first trial if the old session relied on Connectome to fit its full history into context. Reconstructing that history may otherwise exceed the provider window; this extension does not silently truncate it.

Existing native/OM compaction summaries and folded branch summaries are preserved as explicitly unprovenanced legacy blocks. They survive rewrites rather than being dropped or assigned fabricated original-turn IDs. A large legacy summary may prevent memory from reaching the intended budget; a fresh session avoids that migration constraint.

Disabling generation (`memory.enabled: false`) delegates future compactions to Pi but still expands already-saved memory blocks identically. Removing the extension entirely leaves a readable native compaction summary. The lib/ab recall reader works independently of the memory extension. Older blocks retain their original rendering (including historical `memory_recall` wording); use lib/ab for those citations too.

## Development

```sh
bun test extensions/memory lib/memory.test.ts
bun node_modules/typescript/bin/tsc --noEmit --skipLibCheck --target es2023 \
  --module esnext --moduleResolution bundler --allowImportingTsExtensions \
  --types bun-types extensions/memory/index.ts extensions/memory/core.ts extensions/memory/memory.test.ts
```

The compaction smoke drives context capture, two successive folds, stable rendering after resume and invalid-pointer rejection with a stub model. `lib/memory.test.ts` exercises recall, pagination, ancestry, omitted reasoning/images, CLI access and concurrent exec cells with separate branch coordinates. These tests do not establish real-provider cache hit rates or long-term memory fidelity.

A September 26 live smoke through Pi RPC and GPT-6 Luna also persisted two consecutive folds, preserved the first block unchanged, and retained a plan-versus-verification distinction. The second memory call used the captured prefix and reported 1,792 cache-read tokens, 514 fresh input tokens and 75 output tokens. This is a small working-path check, not a cache-efficiency benchmark. Native `compaction.keepRecentTokens` had to be lowered before the short synthetic session reached the extension hook.
