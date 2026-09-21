# Orca integration

Orca owns the graphical workspace and terminals. Pi owns conversations and TUI rendering; the board owns cross-session coordination. Workmux remains the fallback outside Orca. BB integration has been removed.

## Setup

Install Orca and its CLI, open the repository in Orca, and launch Pi with this package loaded. Orca supplies `ORCA_WORKTREE_ID` / `ORCA_WORKSPACE_ID`. Reload Pi after updating the package; `/exec-reset` alone does not register new commands.

`ORCA_CLI` overrides the CLI executable path; otherwise Orca’s `ORCA_CLI_COMMAND` / dev-build environment is honored. `PI_ORCA_COMMAND` is an optional trusted shell command for launching Pi (default `pi`); use it for a custom launcher or extra package/extension arguments. Forks do not reconstruct the parent process’s one-off command-line flags. Normal Pi configuration is loaded by the new process.

The adapter uses explicit checkout selectors, not whichever workspace happens to have focus. It targets local macOS/POSIX hosts; remote routing has not been implemented.

## Fork a conversation into a tab

In an idle Pi session, run `/fork-tab Alternative approach`. A snapshot of the session is persisted immediately and launched as another Pi terminal in the same workspace. The original process stays on its original session. Both tabs share files; this is conversation isolation, not a worktree fork.

The command preserves Pi’s persisted session tree through `SessionManager.forkFrom`; it opens at the calling session’s selected leaf. It does not copy exec’s heap. `/fork`, `/clone`, and `/tree` retain their normal in-terminal behavior. Selecting an earlier message directly from `/fork-tab` is not implemented.

If launch fails, the fork is retained and its path reported. Inspect Orca before retrying: a timed-out creation may already have produced a tab. Fork ancestry is stored by Pi; Orca displays sibling tabs, not a conversation-family tree.

## Workers and readers

[Dispatch](dispatch.md) launches prepared workers into nested Orca worktrees with explicit parent-scoped concurrency. Board subscriptions supply reports/wake and follow-up messages. Failed launches preserve their worktrees and prompt files; no automatic merge or deletion occurs.

[Autoread](autoread.md) launches a restricted reader TUI in the same workspace and collects its structured result. Its PTY is stopped after completion or cancellation; the Pi session and result files are retained. Terminal handles can become stale after closure. There is no automatic cascading lifecycle when the parent tab closes.

## Live acceptance check

1. Run `/fork-tab Alternative` after a distinctive conversation turn. Check two tabs, shared checkout, independent session files, inherited context, and unchanged original session.
2. In the fork, exercise exec output, `@` completion, image input, and Orca’s Pi status/restart/history behavior.
3. Subscribe to a run topic; dispatch one worker. Check a nested worktree, the intended model/effort, board reporting and steering, then review and clean up.
4. Run autoread on a small session, then one needing compaction. Check a visible reader, returned briefing/submission, and stopped PTY with retained session/results. Repeat with abort/timeout.

Basic live fork, worker, and reader checks passed on Orca 1.4.206: [verification](research/orca-integration-2026-09-21.md). Compaction, structured submissions, cancellation, image rendering, and restart/history remain follow-up checks.
