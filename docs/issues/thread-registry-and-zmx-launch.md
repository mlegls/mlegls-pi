---
stage: done
assignee: agent:technical
author: session:01a0f6e1-7ec3-7620-b7fd-edc63c2b3d94
part-of: "[[projects/mlegls-pi/issues/thread-core-and-workers-on-zmx]]"
priority: 2
---

Session mode: hacking. Preserve [[projects/mlegls-pi/stories/work-in-threads]]. The decisions in [[projects/mlegls-pi/issues/thread-registry-on-zmx]] and the committed `lib/thread/index.ts` seam are the contract; the seam is currently throwing stubs, not a second backend. Source evidence: [zmx/pi launch constraints](../attachments/thread-core-and-workers-on-zmx/source-contract.md).

Implement `lib/thread/{registry,runtime}.ts`, with internal helpers under `lib/thread/`; own `types.ts` changes only when all published consumers remain compatible. Leave `lifecycle.ts`, the CLI and worker consumers to their tickets.

## Edits

- Records are `$XDG_STATE_HOME/ab-threads/<id>.json` (default `~/.local/state`), atomically replaced. `id` is the first canonical pi id forever; `sessionId/sessionFile` move together. `allThreads` excludes archived by default; `threadForSession` resolves current identity, not an arbitrary earlier session in that thread. `workerThread` is a unique active run/handle match in cwd's git repository; a bare handle rejects ambiguity. Never infer identity from the worktree layout.
- `newThread`: default is a new owning worktree. `in` uses that cwd as a guest (main or existing worktree); never claims somebody else's worktree. Resolve project/worktree/branch using git. Default branch/name is the allocated thread id; a worker supplies its handle. Create under `<main-checkout>__worktrees/<name>` with `git worktree add`. `base` selects the initial ref, not the integration parent. Write `branch.<branch>.ab-parent` from the spawning checkout's branch; never a SHA or `workmux-base`. Explicit/default parent is a thread id; a free spawning pi remains free.
- `forkThread` resolves an id/file, uses pi's `SessionManager.forkFrom` once for the destination cwd, and starts that new persisted session with `--session <file>`, not recurring `--fork`. `promoteThread` registers the existing session where it is as a guest, without a fork or ownership claim. Existing canonical membership returns that thread rather than duplicating it. A canonical pi already alive outside zmx must not get a concurrent writer: the agent runner waits while that external canonical process is live, then resumes it when it exits. Free sessions are otherwise untouched.
- Persist a valid header-only new session before launching pi; the SDK buffers empty sessions and opening a nonexistent path changes the id. Use the documented header and public SessionManager APIs, not a fabricated assistant message/private flush. Forking is already persisted by `forkFrom`.
- Each terminal is `<id>.<role>`, labelled with `thread=<id> role=<role>`. Detached launch is `zmx run <name> -d …`, then `zmx set`. Use argv, quote trusted shell overrides, clear inherited `ZMX_SESSION` for background commands. `ensureTerminal` is idempotent; aux roles start the user's shell in the thread cwd. Discover with zmx's tab-separated key=value output, not invented JSON. An unavailable/malformed listing is an error, not an empty list.
- The agent runner loops while the record is active, rereads its current session file on each restart, and invokes pi as a child (not `exec` replacing the restart loop). No signal remapping. First launch receives the bootstrap prompt once; restarts use prompt-free `pi --session <current-file>`. Retain model/thinking args and worker env. Explicit `cmd` retains wm's trusted command override; distinguish pi launch overrides from non-pi command fixtures so a shell worker is not mistaken for a live pi.
- Normal threads report on `thread/<id>`; workers on `<run>/<handle>`. Set `AB_THREAD_ID` and `PI_BOARD_TOPIC` on launches, overriding inherited parent identities. Preserve explicit worker env from `launch.env`; do not silently inherit the parent's worker topic/run/handle for a non-worker thread.
- `threadSnapshot/listThreads` join readLive's current-session pi pid/state, fresh board report and zmx terminal inventory. Expose the recorded ownership and `blocked` state. Read merge lineage from git config; resolve its thread through an owning branch in the same project (guests never become branch owners). Spawn tree uses record.parent; merge tree uses ab-parent, not branch-name/merge-base heuristics. Roots then children, siblings by created/id, with depth and treeParent. Default CLI listing is global active threads; optional library cwd scopes a git project. Keep free sessions out.
- `sendThread` sends one literal text argv to `zmx send <id>.agent`; no CR added. `historyThread` calls plain `zmx history` and slices lines locally when requested. `attachThread` ensures the role then attaches with inherited stdio, preserving zmx's explicit switch behavior when called in an attached pane.
- Own `mise.toml`: run `mise use zmx` and define `setup` as `bun run setup`. New worktree creation runs `mise run setup` only when `mise tasks ls --json` in that destination declares the task. Mirror `lib/reconcile/checks.ts:declaredGate` for task discovery. Setup must finish before launching the agent. Do not delete `.workmux.yaml` or global workmux config (deletion ticket owns that). Failed launch/setup must identify its id/path and leave every partial resource registered or cleaned, never an unowned zmx session.

## First use / acceptance

Use a temporary git repository and isolated XDG state/board directory; zmx is provided by this checkout's mise. Exercise owning new, guest in main and an existing worktree, fork, and promote. A project setup marker proves setup ran once only for a new worktree with a declared task; a project with no setup starts normally. Observe records, labelled zmx sessions, both list orders and exact current pi ids before/after a restart. Quit a canonical pi: it comes back with the same id and no second submission of the prompt. Promote a live external pi without a concurrent writer; after it exits, the runner resumes that identity. Send literal input without CR, inspect history, then explicitly submit it.

Expose the temporary fixture's entry command and ids to the driver; fixtures need no GUI/auth except a normal pi persona for the restart/prompt encounter. Clean all terminals/worktrees you created (the lifecycle child is not ready: use explicit git/zmx cleanup). Run existing regressions and `bunx tsc --noEmit`; plugin typing setup workaround is [[projects/mlegls-pi/issues/root-setup-still-omits-obsidian-typecheck-dependencies]]. No tmux/workmux command may be used for new resources.

## Result

[Independent first-use packet](../attachments/thread-registry-and-zmx-launch/index.md): owning/guest/fork/promote, trees and labels, same-id restart with one bootstrap, current-session switching, literal send/history and headless attach/detach held. Repeated auxiliary-role ensure remains unobserved through the provided entry; reviewer check C6 records the missing measurement. Captured [fork wake-routing observation](forked-thread-retains-parent-board-subscriptions.md) and [fixture help/PTY friction](thread-fixture-help-and-headless-pty-entry.md). All disposable resources cleaned; regressions and typecheck passed with the documented Obsidian setup workaround.

## Verification evidence

[Encounter and evidence](../attachments/thread-registry-and-zmx-launch/index.md).
