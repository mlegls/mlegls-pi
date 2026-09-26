# Memory log

One-shot observation, reflection and reconciliation at compaction. No background model calls or separate memory database: Pi's session tree owns the blocks, original entries and branch history.

- `/compact [focus]` or `/memory fold [focus]`: append one new memory block, retaining a short verbatim tail.
- `/memory rewrite [focus]`: consolidate existing blocks and the folded suffix in one call.
- `/memory`: block/claim counts and approximate memory size.
- `memory_recall({ids, offset?, limit?})`: retrieve original entry IDs cited by memory, on the current branch. Long text is paginated; images and reasoning are not returned.

Observations retain surprising or indispensable facts, constraints, corrections and uncertainty. Reflections summarize activity, decisions/reasons and unfinished work. Each claim cites original entries. Corrections explicitly supersede earlier claim IDs. Rewrites resolve those relationships and keep direct original-entry pointers, not chains of summaries.

## Context and cache

Normal calls contain separate stable user messages for each memory block, followed by the recent history. Appending a block leaves older block bodies and timestamps unchanged. The replaced suffix and retained tail still require processing after the cut. A rewrite intentionally invalidates the memory prefix.

The extension captures the latest context-hook messages, effective system prompt and active tool definitions. At compaction it appends subsequent session entries and a checkpoint instruction to that captured prefix, then makes one request through Pi's model registry using the current model, thinking level and session ID. Tools remain advertised for prefix stability, but are never executed by the memory call; any returned tool call invalidates the checkpoint.

After reload/model changes/branch switches, a compatible captured prefix may be unavailable. In that case it reconstructs context from Pi's session tree. Successful compaction details record `prefixMode: captured | reconstructed`, operation, model, latency and usage; usage is also returned to Pi. No provider-specific compaction endpoint is used, and no explicit cache-disable option is set. Actual cache hits remain provider-dependent; context-hook equality is not proof of identical provider payloads, especially with other transforming extensions.

## Settings

Global `~/.pi/agent/settings.json` and project `.pi/settings.json`, under `memory`:

```json
{
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

Pi's ordinary automatic-compaction triggers still apply. Topic-boundary folding is explicit; there is no additional automatic trigger or background production. The extension uses Pi's tool-safe cut-point selection with its own smaller tail. If there is nothing outside that tail, it declines to compact.

Malformed JSON, invalid source/supersession IDs, interrupted/length-limited generation, tool calls and branch changes cancel compaction rather than falling back to a lossy native summary. The prior context is retained. Failed-generation spend is not recorded in a successful compaction entry.

## Switching backends

The package loads this extension instead of Connectome. Do not also load Connectome or observational-memory compaction hooks. Existing Connectome stores are untouched; named lives and `PI_CONNECTOME` routing are not implemented here. Use a new session for the first trial if the old session relied on Connectome to fit its full history into context. Reconstructing that history may otherwise exceed the provider window; this extension does not silently truncate it.

Existing native/OM compaction summaries are preserved as an explicitly unprovenanced legacy block on the first fold. They survive rewrites rather than being dropped or assigned fabricated source IDs. A large legacy summary may prevent memory from reaching the intended budget; a fresh session avoids that migration constraint.

Disabling generation (`memory.enabled: false`) delegates future compactions to Pi but still expands already-saved memory blocks identically. Removing the extension entirely leaves a readable native compaction summary; structured block rendering and `memory_recall` require the extension.

## Development

```sh
bun test extensions/memory
bun node_modules/typescript/bin/tsc --noEmit --skipLibCheck --target es2023 \
  --module esnext --moduleResolution bundler --allowImportingTsExtensions \
  --types bun-types extensions/memory/index.ts extensions/memory/core.ts extensions/memory/memory.test.ts
```

The smoke test drives context capture, two successive compactions, stable block rendering after resume, source recall and rejection of invalid pointers through the extension hooks with a stub model. It does not establish real-provider cache hit rates or long-term memory fidelity.
