# Autoread

A read-only reader fork returns understanding for a parent session's next task, not a transcript of its exploration.

In exec, after reloading the extension (once, to pass the parent session path):

	autoread.run(request)

Long work needs no special handling: exec yields the cell and delivers the shown result by handle when it settles.

	state.reading = autoread.run("Explain the module loader and where to add a library function");
	show(state.reading);

If something later depends on it, `await wait("c7.2")` (the handle printed when the cell yielded) or `await state.reading` in a later cell.

Model and effort defaults live in [`workflows.json`](../workflows.json), under `autoread`. They are read on every call through `config.workflow("autoread")`, so config edits need no reload. The default is OpenRouter’s rolling DeepSeek Flash Latest alias (`openrouter/~deepseek/deepseek-flash-latest`), effort `low`. Per-call `{ model, effort }` overrides remain available. This config selects the reader; native compaction still uses the inherited parent model.

Returns `{ text, sessionFile, model, terminalHandle?, submission? }`. `text` is only the reader’s final answer; `sessionFile` retains its evidence and lineage for inspection. In Orca mode, `terminalHandle` identifies the visible reader.

## Orca backend (host-local default)

Inside Orca (without `PASEO_AGENT_ID`), readers run by default as Pi TUI terminals in the calling checkout’s Orca workspace. They fork the persisted source session, compact using its inherited model, then switch to the reader model/effort and submit the request. Follow-ups use `{ sessionFile: briefing.sessionFile, compact: false }`.

Readers load only exec, observational memory (unless disabled), and the reader host/optional submission extension. The reader profile removes editing, shell, skill execution, UI, terminals, coordination, and automatic library/project modules. This is not an OS sandbox.

The host returns typed submission details through an atomic same-host result file under `$PI_CODING_AGENT_DIR/autoread/<readerId>/` (default `~/.pi/agent/autoread/`). Configuration and results contain session data and remain for inspection. Completion, timeout, and abort stop the PTY; sessions remain resumable from their files. Orca may retain an orphan transcript, but the returned terminal handle can become stale after closure and is diagnostic, not a durable session identity. There is no Orca-native parent/child conversation lineage or cascading ownership.

Use `{ backend: "pi" }` for a private subprocess instead. Both backends accept `cliPath` and `memoryExtension` overrides. Orca mode requires a locally accessible CLI, source session, and workspace; cross-host reader execution is not supported.

## Private Pi backend

Paseo does not get a visible reader adapter in this trial. The historical BB reader depended on native fork/compact; parity is not assumed. The private child clears Paseo and Orca identity variables and retains existing typed submission results. Live Paseo/Pi extension and OM compatibility remain to be verified.

This is the default in Paseo and standalone; `backend: "pi"` selects it explicitly elsewhere. Import `run` from `lib/autoread.ts` and supply `sessionFile` explicitly when not in exec. It never guesses the newest session.

The reader forks the persisted parent through pi RPC, compacts the child, switches to the configured model/effort, then investigates. Small/already-compacted sessions retain their existing context. The parent model, memory, transcript, and files are not changed. The system stance and current request both identify the child explicitly: inherited messages are evidence, not the child’s running exec state or pending work.

Reader-profile exec and observational-memory recall are available, plus an optional submission tool. Other extensions, skills, and prompt templates are not loaded; project context still follows pi's normal loading. See the [reader profile](../extensions/exec/README.md#reader-profile) for the exact API and its non-sandbox boundary.

Observational memory defaults to the installed package under pi's agent npm directory (honoring PI_CODING_AGENT_DIR). Override its path with memoryExtension, or explicitly use memoryExtension: false for native compaction. Existing OM entries survive the fork and recall resolves their original evidence. With no applicable observations, OM falls back to pi's native summarizer. Compaction happens before the model switch, so native compaction uses the inherited model.

Options also include cwd, compact: false, timeoutMs (five minutes by default), signal, and cliPath. Timeout/abort stops the reader; failures are not returned as successful briefings. Fork files are retained, including on failure. No routing, worker dispatch, cross-call cache, or parent-context injection is implicit.

## Structured return channel

A caller needing structured evidence can supply `submission: { extension, tool }`. The explicitly loaded extension owns the native tool schema and returns its validated payload in tool-result `details`. Autoread captures a successful execution of that named tool as `briefing.submission`; it never parses the assistant’s prose. A terminating submission tool can end the reader without a follow-up model turn. Missing submissions or reader errors reject; `text` is incidental in this mode. The extension is trusted caller code, not a sandbox. The default reader remains unchanged.

Orientation uses an ordinary free-text briefing; bounded readers may use a submission tool when their caller needs typed results.

Session preparation additionally checks the initial orientation’s semantic validity with Jev before choosing work. A nonempty parent-style acknowledgment or promise to wait is rejected there. Direct autoread remains a transport/completion check, and reasoning triage stays verbatim without semantic rejudgment.
