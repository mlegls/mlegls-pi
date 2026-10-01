---
name: mlegls-pi
description: "Use when editing this package from any session: repo layout, testing and reloading."
---

canonical checkout `~/dev/mlegls-pi`. worktrees under `~/dev/mlegls-pi__worktrees/`. pi-package: `extensions/`, `lib/` (host extensions are `lib/<name>/host.ts`), `skills/enabled/pi/{pi,mlegls-pi}`, `prompts/`, `themes/`. user skills `skills/enabled`, `agents/`, `agent-prompts/` (system-config symlinks these and runs agents-apply).

every extension entrypoint is listed explicitly in `package.json` under `pi.extensions`. `/reload` or restart pi after changing extension code. `bun test`; `bunx tsc --noEmit` for typechecking.

## hosts

Workers run as `wm` workers (workmux + tmux) and report over the board; `dispatch` launches prepared assignments. Every session also listens on its mailbox, board topic `mail/<last 8 hex of its session id>` (`lib/board/mailbox`).

Worker handoffs separate observations from hypotheses. For data claims, include the identifiers actually joined (for example Session → thread → messages), not just a row count. “53 messages exist on thread X; its Session ownership is unchecked” is evidence; “Session Y lost its messages” is not established by that count.

Use a dedicated worktree for source edits. Before committing shared tracker changes in the canonical checkout, inspect the staged paths; other sessions may be staging there concurrently. Do not include their changes in your commit.
