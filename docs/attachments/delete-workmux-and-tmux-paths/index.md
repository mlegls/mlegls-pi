# Delete workmux and tmux paths — first-use evidence

## Before use: predictions

- Prepared dispatch documentation will describe workers as threads with worktrees and zmx sessions, not workmux/tmux windows.
- Existing workmux and tmux executables will still be available; removal is of integration code, not installed tools.
- The documented `ab tree` CLI will remain reachable. No worker creation or shared-session mutation is authorized by the null setup handoff.
- Internal path deletion, live-record field removal, system-config commit and suite/typecheck success cannot be established by a non-technical first-use encounter; those require reviewer inspection/checks.

## Setup

Tested revision: `a33a06c809ec9683e905d75f55ad96de0b8616d0`.
Checkout: `/Users/mlegls/dev/mlegls-pi__worktrees/delete-workmux-and-tmux-paths-drive-2`.
Setup handoff was null: no deployment, persona/auth, seed, launch command or checkout-owned runtime supplied. This encounter uses documentation and installed CLI discovery only; no inherited session is treated as this checkout's deployment.

## Encounter and outcomes

1. Read `README.md` and `docs/dispatch.md`. Prepared dispatch explicitly calls each worker a thread with a worktree and zmx session. **Held**; documentation prediction met. The delivered session's supervision namespace description still says “workmux worktree + tmux window running pi”; its loaded provenance is unknown, so the updated namespace cannot be verified from this session.
2. Ran `command -v workmux; command -v tmux`. Both resolve to installed executables (mise and Nix respectively). **Held**; binary-preservation prediction met.
3. Ran `ab tree --help`. It reached the canonical checkout, not this worktree, and exited 1. Retried `./bin/ab tree --help`; the stack trace identifies this worktree, again exiting 1 with `ERR_PARSE_ARGS_UNKNOWN_OPTION`. The CLI entry is reachable, but the expectation of discoverable usage was **not met**. No tree UI or shared-session mutation was attempted.
4. Internal integration removal, field removal, system-config commit and test/typecheck claims are **unobservable** through these user surfaces. The assignment excludes source inspection and repository checks; no owned runtime/setup was supplied for a worker lifecycle journey. These remain reviewer/integration acceptance work under the originating ticket, not waived requirements.

## Frictions

- Tree help raises an argument-parser stack trace rather than usage. Existing owner: [[projects/mlegls-pi/issues/archive/ab-tree-help-runs-option-validation]].
- Global `ab` targets the canonical checkout. Workaround for CLI discovery: explicit `./bin/ab`.
- Null setup supplies no isolated worker/thread seed or runnable lifecycle journey.

## Replayable checks

- Read `docs/dispatch.md`: accept thread/worktree/zmx wording without describing workmux/tmux workers.
- Run `command -v workmux; command -v tmux`: accept both executable paths still resolving.
- Run `./bin/ab tree --help`: accept concise usage, exit 0, no parser stack trace (currently not met; existing friction owner above).
- In a newly loaded checkout-owned Pi session, inspect the supervision namespace description: accept thread/zmx wording rather than workmux/tmux. This session cannot establish that load.
- Reviewer must establish the ticket's removal and suite/typecheck claims; this packet does not assert them.

## Cleanup

No servers, workers, pages, containers or other resources were started. Nonvisual encounter; no screenshots.

## Review

Reviewed `71de92e..661c610` against the ticket.

- Removal held: `.workmux.yaml`, `bin/ab-nav`, the `@mailbox` tmux call in `lib/board/host.ts`, `tmuxPane` in live records/child-exit message, `pane` in `lib/tree/graph.ts`; `grep -rniE 'workmux|tmux'` outside docs/attachments and docs/issues leaves only deliberate hits (env scrubbing of inherited `TMUX*` in thread launch/tests, `cyber-mux` description, a pre-cutover reconciler error, a "no tmux dashboard" note).
- system-config: commit `0114f37` removes workmux config, status extension and tmux bindings; `cargo:raine/workmux` stays in mise so the binary stays installed, as the ticket asks.
- Repairs: a dangling "footer and." comment in `lib/board/host.ts`; "a thread: a worktree…" grammar in `docs/dispatch.md`.
- Checks: `bun test lib/tree lib/session-meta lib/board lib/children*` 48 pass, 0 fail. `tsc --noEmit` reports only `extensions/obsidian-tracker/*` errors (`obsidian` types not installed in this worktree); none elsewhere.
- Namespace load: the `supervision` description in `extensions/supervision/index.ts` now reads "threads: a worktree and a zmx session running pi"; a fresh session load wasn't driven, the source string is the claim.
