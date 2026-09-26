# connectome

Not loaded by default. The package currently uses [memory](../memory/README.md); explicitly replace that extension with this one to return to Connectome. Existing Chronicle stores are retained.

Uses Anima Labs' [context-manager](https://github.com/anima-research/context-manager) (the memory layer of [Connectome](https://animalabs.ai/connectome/)) as pi's memory and compaction backend.

- `/workspace` keeps the current life, including its memories and folding state, across projects and subsequent resume. An explicit `use` or `default` clears that binding. Actual forks do not inherit the workspace binding; named lives still share by name.
- If compilation fails, Connectome steps aside until session reload or an explicit identity choice, allowing Pi's own compaction rather than repeatedly sending oversized raw history.
- Every message pi sends is mirrored into a Chronicle store, a "life". By default each session has its own; named lives are shared across sessions, so `/new` and later sessions attached to the same name continue it.
- Before each LLM call, the messages are replaced with the store's compiled view. Recent history stays verbatim. Older history becomes first-person memories written by the session's own model (`AutobiographicalStrategy`, `kv-stable` folding).
- Memory writes reuse the live prefix and session id, so they can hit the prompt cache.
- pi's own compaction is cancelled. `/tree` navigation branches the store at the newest shared message, so it works as time travel in the life.

## Identity

A named life lives at `<root>/<project>/<name>/<model id>`. `<project>` is the git common dir, so worktrees of one repo share lives. A name starting with `/` is project-independent: `<root>/_global/<name>/<model id>`. The default, `@session`, is `<root>/<project>/_sessions/<session id>/<model id>`: resume keeps it, `/new` starts another. Sessions choose a name; the model part follows the model selection, so `/model` moves the session into that model's life under the same name. Lives are created on first use.

For example, keep `supervisor` (remembers past failures) and `main` (design) perpetual and attach to them with `/connectome use`; everything else stays per-session.

The name is resolved at session start and the life opens at the first model call. Precedence:

1. An in-session choice: `/connectome use <name>`, `/connectome off`, `/connectome default` (falls back to 2–4). It is persisted in the session, so resume keeps it. Messages already mirrored into the previous life stay there; the new life takes in the session's whole branch.
2. `PI_CONNECTOME` from whoever launched pi: a name, `@session`, or `off`. Dispatched workers are task-scoped, so a launcher sets `@session` unless the task names a life.
3. `connectome.identity` in settings.
4. `@session`.

`/connectome list` shows this project's names (and `/` names) with the models each has lives for; `use` completes them and `@session`. Per-session lives aren't listed and aren't pruned.

## Settings

Settings go under `connectome` in `~/.pi/agent/settings.json` or `<cwd>/.pi/settings.json`: `identity` (a name), `enabled`, `dir`, `agentName`, `budgetRatio` (default 0.5), `budgetTokens`, `reserveForResponse`, `strategy` (passthrough overrides for `AutobiographicalConfig`).

Settings are read when a life opens. Existing lives survive `/reload`; after changing strategy settings, restart/resume Pi or use `/connectome off` then `/connectome default` to reopen with the new defaults. The store and memories are retained. `strategy.logEffectiveConfig: true` writes initialization provenance to the life's `lib.log`.

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
