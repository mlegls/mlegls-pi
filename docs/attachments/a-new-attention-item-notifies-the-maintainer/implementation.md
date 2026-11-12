# Attention notification implementation trial

Base: `ffca796202d317359ab250f5089ad3cb40a5a526`.

## Setup and first use

Local CLI using the existing bb daemon and live owner `thr_gwqgvdrzfg` (`BB_THREAD_ID`), with no new credentials or threads. The checkout's `bin/desk` was invoked from a disposable linked worktree at `/tmp/desk-attention-implement-uTtdNl/worker`; its main checkout was `/tmp/desk-attention-implement-uTtdNl/main`. Git initialization, an empty commit and worktree creation all completed before use. The fixture was removed afterward. The shared project desk was untouched.

Entry point and reproducible preparation: [the desk guide's safe first-use setup](../../guide/desk.md#safe-first-use-setup). It uses the checked-out helper directly, so no installed CLI link or ignored setup file is required. Run in a shell retaining the current live `BB_THREAD_ID`.

Ran the guide's attention sequence once, with title `TEST: desk attention notification`: add first body, repeat it, then add changed body. All three commands returned the fixture's desk path and exited zero without notification errors. The plugin was enabled with web, desktop and mobile enabled and one mobile subscription. Status reported a successful mobile send with `sentCount: 1` after the sequence. Status is global and changed between the first and identical adds too; it cannot identify this trial's individual sends amid other thread notifications. Device banners and click-through were not observed here. Do not repeat real pings casually during subsequent verification.

## Temporary diagnostics (no real delivery)

An executable shim delegated thread lookup to the real bb CLI, recorded notification arguments and returned simulated delivery responses. It was diagnostic scratch, not a committed test or a required setup dependency.

- New item, identical repeat, changed body and cleanup produced exactly two notification calls: `main: TEST diagnostic`, first body then changed body, both targeting `thr_gwqgvdrzfg`. The resulting desk contained one item with the changed body.
- A body containing two paragraphs sent only the first paragraph, joining its continuation line with a space.
- Simulated plugin failure with multiline stderr produced one stderr line, retained the full item on disk and exited zero.
- Simulated success with empty channels produced one stderr line, retained the item and exited zero.

`bun run typecheck` passed. No existing desk regression tests were found; no permanent tests were added. No servers, browsers or external deployments were started.
