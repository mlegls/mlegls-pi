# Exec host-library migration — 2026-09-21

Starting ref: `1614d31697836882ad6bb19ba1d90bb7708f21f4`.

## Observed

- `env -u BB_THREAD_ID bun test`: 196 passed, 2 skipped, 0 failed
  (198 tests across 31 files). The unset isolates standalone Pi coordination from
  BB's deliberate board disablement. The skipped tests require local concurrent
  workmux workers; no new workers were launched.
- Pi's real extension loader, given only `extensions/exec/index.ts`, returned one
  extension and no load errors. Commands: board, record, jump, workspace,
  computer-use, exec-reset. Registered tools: workspace_request and exec.
  Lifecycle hooks included session start/tree/shutdown, before-agent-start, and
  tool-result. Existing integration tests drove board delivery/acknowledgment,
  terminal persistence across kernel resets, and exec flag/reset behavior.
- Installed Pi 0.85.1:
  `pi --no-extensions -e ./extensions/exec/index.ts --list-models featherless`
  exited 0 and listed the Featherless catalogue. No model inference was requested.
- A temporary host-library directory with a synchronous installer, a failing
  installer, and an asynchronous installer loaded in name order. Loading it twice
  registered the two successful commands only once and reported the same one
  failure each time. The temporary directory was removed.
- `bunx tsc --noEmit` still reports the four pre-existing errors in
  `lib/session/tmux.ts` (nullable child streams) and
  `lib/system-prompt/index.test.ts` (optional callback). Before migration it also
  reported an Exa test typing error, now in the excluded archive.
- `git diff --check`: clean.
- `scc-delta.sh` against the starting ref: code 30,496 → 30,720 (+224),
  complexity 4,133 → 4,195 (+62). Totals include the preserved standalone Board
  adapter alongside its slimmer active host integration. SCC was run through
  `mise exec aqua:boyter/scc@4.1.0` because its shim had no active version.

## Boundaries

Host installation is extension-load-time, not runtime hook replacement.
`/exec-reset` reloads only cell code; use Pi `/reload` for host code.
The existing workspace approval tool remains registered. Human-facing commands
were inspected for registration, not driven to switch the user's session or write
vault conclusions. No new desktop permission/capture flow was exercised.
The non-transactional installer limitation is recorded in `docs/frictions.md`.

## Boundary correction

Featherless, fence, system-prompt, and workspace were subsequently restored as
standalone extensions: they have no callable interface in exec. The package
manifest now loads five extensions. Pi’s real loader reported no errors; exec
registered only the exec tool, while workspace owned workspace_request and
/workspace. Board, record/vault, terminals, and worker provenance remain
exec-installed host libraries. The earlier sole-extension observations above
describe the initial migration, not the corrected layout.

SCC against `3d57a72`: code 30,720 → 30,716 (-4); complexity unchanged at 4,195.
Typechecking still reports the same four pre-existing errors (system-prompt
now under `extensions/`, session subprocesses under `lib/`).

After correction, `env -u BB_THREAD_ID bun test`: 196 passed, 2 skipped,
0 failed. Installed Pi also listed Featherless models successfully with only
`-e ./extensions/featherless/index.ts --no-extensions`, independently of exec.
