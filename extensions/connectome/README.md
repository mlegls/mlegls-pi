# connectome

Uses Anima Labs' [context-manager](https://github.com/anima-research/context-manager) (the memory layer of [Connectome](https://animalabs.ai/connectome/)) as pi's memory and compaction backend.

- Every message pi sends is mirrored into a Chronicle store that belongs to an identity, not a session, so `/new` and later sessions continue the same life.
- Before each LLM call, the messages are replaced with the store's compiled view. Recent history stays verbatim. Older history becomes first-person memories written by the session's own model (`AutobiographicalStrategy`, `kv-stable` folding).
- Memory writes reuse the live prefix and session id, so they can hit the prompt cache.
- pi's own compaction is cancelled. `/tree` navigation branches the store at the newest shared message, so it works as time travel in the life.

## Identity

The identity is resolved at session start and opened at the first model call. Precedence:

1. An in-session choice: `/connectome use <identity>`, `/connectome off`, `/connectome default`. It is persisted in the session, so resume keeps it. Messages already mirrored into the previous life stay there; the new life takes in the session's whole branch.
2. `PI_CONNECTOME` from whoever launched pi: an identity, or `off`. Paseo dispatch (`lib/paseo.ts`) sets `off` unless the task names an identity, because dispatched agents are task-scoped.
3. `connectome.identity` in settings.
4. `<repo>/<model id>`. The repo is the git common dir, so worktrees of one repo share a life.

`/connectome list` shows existing identities; `use` completes them.

## Settings

Settings go under `connectome` in `~/.pi/agent/settings.json` or `<cwd>/.pi/settings.json`: `identity`, `enabled`, `dir`, `agentName`, `budgetRatio` (default 0.5), `budgetTokens`, `reserveForResponse`, `strategy` (passthrough overrides for `AutobiographicalConfig`).

## Inspection

`/connectome` shows the store, summary levels, pending work and render stats. Each life directory (`~/.pi/agent/connectome/<identity>/`) contains:

- `store/`: Chronicle
- `calls.jsonl`: one line per compile
- `memory-writes.jsonl`: model, latency, cache read/write and cost per memory write
- `lib.log`: context-manager's console diagnostics, which would otherwise draw over the TUI

## Known limits

- The Chronicle store takes an exclusive lock. A second concurrent pi session on the same identity falls back to pi's own context and warns.
- `/fork` is not mapped to a store branch.
- Memory writes use whatever model the session is on at that moment.
- Memory-write usage is logged but not added to pi's session totals.
