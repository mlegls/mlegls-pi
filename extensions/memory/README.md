# Memory log

One-shot cited prose and reconciliation at compaction. No background model calls or separate memory database: Pi's session tree owns the blocks, original entries and branch history.

- `/compact [focus]` or `/memory fold [focus]`: append one new memory block. In the same call, the model chooses where the continuous verbatim tail begins.
- `/memory rewrite [focus]`: consolidate existing blocks and the folded suffix in one call.
- `/memory`: block count, approximate memory size, and the last chosen tail's size and rationale.
- `show(memory.recall({ids, offset?, limit?}))` in exec, or `ab memory recall ID... [--offset N] [--limit N]`: retrieve cited originals on the invocation's branch. Long text is paginated; images and reasoning are not returned. This replaces the standalone `memory_recall` tool.

Recall uses normal model-dependent output filtering: `show.raw(...)` or `ab raw ab memory recall ID` requests exact text; `show.pull` / `ab pull` recovers previously skimmed output. The library itself returns unfiltered text. Bash supplies the session file and leaf; exec retains a separate leaf for each asynchronous cell and passes it to its shells. Offline reads require explicit `sessionFile`/`leafId` or `--session FILE --leaf ID`; there is no latest-session/branch guess. Persisted session logs are required.

Memory is free prose with inline original-entry citations (`[@entry-id]`), not separate observation/reflection buckets. What to keep is left to the model; the format does not classify facts. Coverage metadata tracks which turns were folded. Corrections cite earlier blocks (or V1 claim IDs) with the same `[@id]` syntax and state exactly what changed, without invalidating unrelated material. Rewrites reconcile those corrections and keep direct source pointers, not chains of summaries.

New checkpoints use `memory-log.v2`, generated as a `tail: source-id` line and free prose with `[@id]` citations; cited earlier memory IDs become the block's `supersedes`. The model selects one legal original-entry boundary; everything from there onward remains verbatim and in order. Memory covers only entries before it. Source IDs are validated against that covered prefix and existing memory provenance. A boundary cannot begin at a tool result. Unknown boundaries and citations into the newly retained tail reject the checkpoint, rather than silently moving the cut. Existing blocks render unchanged; no migration call is required.

## Context and cache

Normal calls contain separate stable user messages for each memory block, followed by the recent history. Appending a block leaves older block bodies and timestamps unchanged. The replaced suffix and retained tail still require processing after the cut. A rewrite intentionally invalidates the memory prefix.

The checkpoint instruction opens by stating the compaction purpose and the approach: based on Observational Memory, but produced in one shot by the current model with the whole context in view, so free prose with citations rather than separate observations and reflections. It aims at representational stability in the literal KV-cache sense (the replacement context plus verbatim tail should bring the model back close to its current state, not just restore facts), made tractable by self-authoring and introspection. It then states the findings of vgel's "Small Models Can Introspect, Too" and Jack Lindsey et al.'s "Emergent Introspective Awareness in Large Language Models" as facts, points at where to look, lists reflective content to cover ("what surprised you, where your framing shifted..."), then the mechanics, reduced to the interface: a `tail: ID` line, then free prose with citations, within a budget. There is no JSON: structured output around reflections resembles tool-call chain-of-thought extraction, a suspected trigger for the output-duplication filter. It adds no caveat that impressions are fallible: the reader already holds that prior, and anchoring is enforced by required citations and asked for positively ("give each item its handle: the cited phrase or moment"). Whether this elicits introspection rather than summarization is untested. If Anthropic's output-duplication filter blocks the checkpoint, it is retried once without the introspective opening (`register: compaction-om-v10-fallback-plain`). The prompt also identifies whether every assistant turn came from the current model (`selfAuthored`), without claiming continuity of its original processing. Details record `register: compaction-om-v10` and `selfAuthored` for comparison; alternatives and the motivation are tracked in `docs/issues/compaction-register-variants.md`.

Tail selection favors retaining the recent reasoning trajectory needed to continue work, not just isolated useful facts. This version permits only a continuous suffix, not disjoint excerpts. Each successful compaction records `tail.mode: model-contiguous`, its starting ID, estimated tokens, guidance target and model rationale. These records distinguish this policy from earlier fixed-tail compactions for later comparison; representational continuity or a felt benefit is not established by cache-hit tests.

The extension captures the latest context-hook messages, effective system prompt and active tool definitions. At compaction it appends subsequent session entries and a checkpoint instruction to that captured prefix, then makes one request through Pi's model registry using the current model, thinking level and session ID. Tools remain advertised for prefix stability, but are never executed by the memory call; any returned tool call invalidates the checkpoint.

After reload/model changes/branch switches, a compatible captured prefix may be unavailable. In that case it reconstructs context from Pi's session tree. Successful compaction details record `prefixMode: captured | reconstructed`, operation, model, latency and usage; usage is also returned to Pi. No provider-specific compaction endpoint is used, and no explicit cache-disable option is set. Actual cache hits remain provider-dependent; context-hook equality is not proof of identical provider payloads, especially with other transforming extensions.

Old tool outputs are elided only when the prompt cache is already cold. If a user message arrives after an idle gap longer than the cache lifetime of the provider that served the last assistant message before it, tool results of at least `minTokens` from before the last `keepTurns` user turns are replaced with a pointer (`ab memory recall ENTRY-ID`). Tool calls and result messages stay in place, only the bodies change. This is computed purely from the branch (message timestamps and providers): gaps never move, so the rendering changes only at a new cold gap and stays byte-stable between them, whether after a reload or on another branch. The rewrite therefore lands when the provider would re-prefill anyway. Compaction sees the elided bodies; the compaction call can't recall them yet, since it doesn't execute tools.

Default lifetimes err long, so they under-elide: Anthropic, Bedrock and xAI 330s (a 5-minute TTL refreshed on each hit); OpenAI, Codex and Azure 3660s (OpenAI: "5-10 minutes of inactivity, up to one hour"). Anything unpublished or best-effort (DeepSeek's "hours to days", Z.ai, Gemini implicit caching, routers) falls back to a day. With `PI_CACHE_RETENTION=long`, Pi requests 1h Anthropic and 24h OpenAI retention, and the defaults follow. `idleSeconds` accepts an object of provider overrides (plus `default`), or a single number for every provider.

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
    "maxOutputTokens": 12000,
    "elide": { "enabled": true, "idleSeconds": { "openai-codex": 3660, "default": 86400 }, "minTokens": 500, "keepTurns": 1 }
  }
}
```

Sizes except the provider output cap are approximate targets (characters/4). A fold becomes a rewrite when the existing memory reaches `memoryTokens`; a newly appended block can cross that threshold until the next fold. `rewriteTokens` is deliberately lower, leaving room for subsequent blocks. A rewrite that still exceeds `memoryTokens` is rejected. The output cap also needs room for reasoning and JSON, not just rendered memory.

Pi's ordinary automatic-compaction triggers still apply. Topic-boundary folding is explicit, with no background production. `memory.keepRecentTokens` (default 2000) now gives the model soft size guidance, not a mechanical cut or hard cap. The model may retain more or less. Native `compaction.keepRecentTokens` remains a separate eligibility gate: Pi prepares a cut before invoking extension hooks. Keep that setting small to let short conversations reach the hook; the final boundary is model-selected. If the chosen suffix leaves nothing new to fold, an append is cancelled without changing context.

A missing tail line, invalid source/supersession IDs, interrupted/length-limited generation, tool calls and branch changes cancel compaction rather than falling back to a lossy native summary. The exception is a provider filter block on both the full and plain checkpoint prompts: that is about the session, so Pi's native summarizer (a separate request over the serialized conversation) gets to try, and the next fold treats its summary as an imported legacy block. The prior context is retained. Failed-generation spend is not recorded in a successful compaction entry.

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
