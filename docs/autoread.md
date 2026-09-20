# Autoread

A read-only reader fork returns understanding for a parent session's next task, not a transcript of its exploration.

In exec, after reloading the extension (once, to pass the parent session path):

	autoread.run(request, { model: "deepseek/deepseek-flash", effort: "low" })

Retain long work rather than awaiting it across exec's default 30-second deadline:

	state.reading = notify(autoread.run("Explain the module loader and where to add a library function", {
	  model: "deepseek/deepseek-flash", effort: "low"
	}), "autoread");

Then in a later cell:

	await show(await state.reading);

Returns `{ text, sessionFile, model }`. `text` is only the reader's final answer; `sessionFile` retains its evidence and lineage for inspection.

Outside exec, import `run` from `lib/autoread.ts` and supply `sessionFile` explicitly. It never guesses the newest session.

The reader forks the persisted parent through pi RPC, compacts the child, switches to the supplied model/effort, then investigates. Small/already-compacted sessions retain their existing context. The parent model, memory, transcript, and files are not changed.

Only read, grep, find, ls, and observational-memory recall are available. Other extensions, skills, and prompt templates are not loaded; project context still follows pi's normal loading. This is a restricted tool surface, not an OS sandbox.

Observational memory defaults to the installed package under pi's agent npm directory (honoring PI_CODING_AGENT_DIR). Override its path with memoryExtension, or explicitly use memoryExtension: false for native compaction. Existing OM entries survive the fork and recall resolves their original evidence. With no applicable observations, OM falls back to pi's native summarizer. Compaction happens before the model switch, so native compaction uses the inherited model.

Options also include cwd, compact: false, timeoutMs (five minutes by default), signal, and cliPath. Timeout/abort stops the reader; failures are not returned as successful briefings. Fork files are retained, including on failure. No routing, worker dispatch, cross-call cache, or parent-context injection is implicit.
