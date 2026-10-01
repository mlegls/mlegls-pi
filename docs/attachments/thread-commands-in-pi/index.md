# Thread commands in pi: first use

The workspace extension now exposes `/thread` through the package's `ab thread` CLI and keeps `/fork-tab` as a fork alias. Canonical session changes update the registry before session-meta runs. Pi 0.99 uses `session_start` with `reason` and `previousSessionFile`; the old `session_switch` event was removed in 0.65.

## Reproduce

```sh
mise exec -- bun docs/attachments/thread-commands-in-pi/fixture.ts prepare
# Use the returned ROOT:
mise exec -- bun docs/attachments/thread-commands-in-pi/fixture.ts attach ROOT
# Or replay the short first-use journey without attaching:
mise exec -- bun docs/attachments/thread-commands-in-pi/fixture.ts smoke ROOT
mise exec -- bun docs/attachments/thread-commands-in-pi/fixture.ts inspect ROOT
mise exec -- bun docs/attachments/thread-commands-in-pi/fixture.ts cleanup ROOT
```

Preparation creates an owned temporary Git repository, isolated thread/board/zmx/agent state, and a canonical guest pi loaded from this checkout. It links the existing local persona's auth file without copying credentials. No model calls are needed for the smoke. The interactive entrypoint lands directly in the canonical pi.

## Observed

[smoke.txt](smoke.txt) records the real TUI commands delivered through zmx and the registry/live readback:

- `/new` changed current session while preserving thread id; `/quit` restarted a new pi pid on that session.
- `/thread fork --worktree x` created an owning child; `ab thread ls --tree spawn` placed it beneath the source.
- Canonical `/workspace <child cwd>` created a guest child there without moving the source.
- `/new` in a free pi remained free; `/thread promote` registered its new session as a guest.

All owned fixtures, external pi processes and authentication links were removed. An initial fixture run accidentally used foreground `zmx run` and stalled before promotion; the recipe now uses `-d`, and the complete journey above was rerun successfully.

## Checks and remaining independent use

`bun test extensions/workspace lib/thread lib/session-meta/index.test.ts`: 28 passed. `bunx tsc --noEmit`: passed after the existing frozen dependency installation in `extensions/obsidian-tracker`. That setup boundary is already tracked in `docs/issues/root-setup-still-omits-obsidian-typecheck-dependencies.md`.

The old fork-tab tests asserted tmux window creation and cyber-mux worktree ownership; they were removed with that transport. No new permanent acceptance tests were added. The fresh driver still owns independent encounters with `/resume`, the alias, lifecycle commands and free workspace switching. Existing workspace handoff/cancellation regressions and thread lifecycle/CLI regressions passed.

## Independent drive

[Predictions, encounter, checks and cleanup](drive.md). Creation, fork/alias, session tracking, promotion and canonical/free workspace behavior held. Bare `/thread archive`, `/thread abandon` and `/thread merge` in an owning child's pi all failed with the cleanup-controller guard; passing a child ID from another pi returned usage. [Lifecycle failure frame](drive-cleanup-errors.png).
