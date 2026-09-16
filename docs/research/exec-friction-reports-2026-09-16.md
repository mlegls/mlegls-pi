# Exec friction reports from multi-agent work — 2026-09-16

Scope: reports posted by seven `wm` workers on the concept repository during one day of
dispatch (refresh-failures, drive-flattening, flatten-leftovers, store-patches-drive,
suite-handoff-review, worktree-bootstrap, transcript-position, recompose-suite). Reported as
observed; none reproduced here. Ordered by how many workers hit them. Reports already
dispositioned in [the same-day verification](exec-friction-verification-2026-09-16.md)
are omitted (cooked shell backslashes, file text as a path, range replacement duplication).

## edit anchors (four workers; one silently lost a ticket claim)

| Report | Detail |
| --- | --- |
| Line numbers read as anchors | The error and help present hunk headers as `=abcd`, which reads like a line number; `=1` / `>2` are rejected with "not a hunk header of known anchors". Two workers tried numbers first. Proposal: accept a line number when the file was read this session, or echo one valid anchor for the file in the rejection. |
| `@path` assertion suffix rejected | `=rs59 rher@docs/...` failed though documented. Either the syntax differs from the README or it is unimplemented. |
| Row objects as anchors | `read(...).lines(n)` rows used as a header throw; only the hex anchors from `read`/`grep` output work. Proposal: accept a row object (it carries its anchor). |
| Bare `-anchor` swallows the next hunk | A deletion hunk with no body followed by a blank line and another hunk parsed the second hunk as the deletion body. `-anchor anchor` or `edit.raw` avoided it. |
| Nested backticks | Cooked `edit`/`edit.raw` templates whose body contains Markdown backticks fail with `ERR_INVALID_TYPESCRIPT_SYNTAX`. Workers fell back to `replace()` or `write()`. |
| Lost claim | One worker's first edit (a ticket `claimed-by` line) failed and it did not notice until its final report; the ticket was never claimed. A rejected edit should be hard to mistake for success in a multi-hunk cell. |

## kernel and API bindings (three workers)

- `const board = await board.read(...)` fails with "Identifier 'board' has already been declared"; likewise `ui`. Reserved API names collide with natural local names. Proposal: reserve names that read as namespaces (`exec.board`) or fail with a hint naming the reservation.
- `term.spawn`'s returned record exposes no plain `id`; `term.wait({ids})` wants the `name`. Return the identifier explicitly.
- `wm.send(handle, text)` from a spawned worker fails with "run (no wm.spawn yet this session) required" although `wm.status` lists the worker's own run; `{run}` explicit works. Infer the caller's run for workers.
- No `ls`; `find`/`read` instead, discovered by failing.
- A cell that exceeds `timeoutMs` clears kernel state; one worker lost `state.startingRef` to `bunx convex logs --history`, which streams and does not exit. Proposal: warn in the description that streaming commands need `term`, and consider preserving `state` across a timeout when the timed-out cell did not write it.
- `show` of several files or a broad `board.read` hits the 16 KiB cap; `show.large` and slicing were the right calls but were found after the cap. Documented bound, not a defect.

## external tools (two workers)

- `chrome-devtools-axi` refs go stale within about a second with no intervening action; `click @ref` never landed on a suggestion button that also sat under an open dropdown, while the ARIA snapshot listed it clickable. `eval` with `querySelector().click()` was reliable. A `screenshot` was needed to see the occlusion.
- Killing a `convex dev` CLI with SIGTERM leaves `convex-local-backend` listening; `pkill -f convex-lo` was needed. Checking the port alone does not confirm "stopped".
- `CONVEX_AGENT_MODE=anonymous convex dev` rewrote tracked `AGENTS.md`/`.agents` on interactive start; the repository now disables `aiFiles` in `convex.json`, which is the CLI's opt-out.
