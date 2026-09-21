# Autoread

A read-only reader fork returns understanding for a parent session's next task, not a transcript of its exploration.

In exec, after reloading the extension (once, to pass the parent session path):

	autoread.run(request)

Retain long work rather than awaiting it across exec's default 30-second deadline:

	state.reading = notify(autoread.run("Explain the module loader and where to add a library function"), "autoread");

Then in a later cell:

	await show(await state.reading);

Model and effort defaults live in [`workflows.json`](../workflows.json), under `autoread`. They are read on every call through `config.workflow("autoread")`, so config edits need no reload. The default is OpenRouter’s rolling DeepSeek Flash Latest alias (`openrouter/~deepseek/deepseek-flash-latest`), effort `low`. Per-call `{ model, effort }` overrides remain available. This config selects the reader; native compaction still uses the inherited parent model.

Returns `{ text, sessionFile, model }`. `text` is only the reader's final answer; `sessionFile` retains its evidence and lineage for inspection.

Outside exec, import `run` from `lib/autoread.ts` and supply `sessionFile` explicitly. It never guesses the newest session.

The reader forks the persisted parent through pi RPC, compacts the child, switches to the configured model/effort, then investigates. Small/already-compacted sessions retain their existing context. The parent model, memory, transcript, and files are not changed.

Reader-profile exec and observational-memory recall are available, plus an optional submission tool. Other extensions, skills, and prompt templates are not loaded; project context still follows pi's normal loading. See the [reader profile](../extensions/exec/README.md#reader-profile) for the exact API and its non-sandbox boundary.

Observational memory defaults to the installed package under pi's agent npm directory (honoring PI_CODING_AGENT_DIR). Override its path with memoryExtension, or explicitly use memoryExtension: false for native compaction. Existing OM entries survive the fork and recall resolves their original evidence. With no applicable observations, OM falls back to pi's native summarizer. Compaction happens before the model switch, so native compaction uses the inherited model.

Options also include cwd, compact: false, timeoutMs (five minutes by default), signal, and cliPath. Timeout/abort stops the reader; failures are not returned as successful briefings. Fork files are retained, including on failure. No routing, worker dispatch, cross-call cache, or parent-context injection is implicit.

## Structured return channel

A caller needing structured evidence can supply `submission: { extension, tool }`. The explicitly loaded extension owns the native tool schema and returns its validated payload in tool-result `details`. Autoread captures a successful execution of that named tool as `briefing.submission`; it never parses the assistant’s prose. A terminating submission tool can end the reader without a follow-up model turn. Missing submissions or reader errors reject; `text` is incidental in this mode. The extension is trusted caller code, not a sandbox. The default reader remains unchanged.

Session preparation uses this for `lib/prepare/candidates.ts`; reasoning-model triage remains ordinary free text.
