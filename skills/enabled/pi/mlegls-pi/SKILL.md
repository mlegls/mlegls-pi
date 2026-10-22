---
name: mlegls-pi
description: "Use when editing this package from any session: repo layout, testing and reloading."
---

canonical checkout `~/dev/mlegls-pi`. worktrees under `~/dev/mlegls-pi__worktrees/`. pi-package: `extensions/`, `lib/` (host extensions are `lib/<name>/host.ts`), `skills/enabled/pi/{pi,mlegls-pi}`, `prompts/`, `themes/`. user skills `skills/enabled`, `agents/`, `agent-prompts/` (system-config symlinks these and runs agents-apply).

every extension entrypoint is listed explicitly in `package.json` under `pi.extensions`. `/reload` or restart pi after changing extension code. `mise run test` for the full suite (host-wide heavy queue); `bun test <file>` is fine for a single file. `bunx tsc --noEmit` for typechecking.

## hosts

Workers run as `wm` workers (bb threads) and report by ending their turn, read from their bb thread (`lib/thread/turn.ts`); `dispatch` launches prepared assignments. Sessions reach each other with `bb thread tell <thread> --mode queue`.

Worker handoffs separate observations from hypotheses. For data claims, include the identifiers actually joined (for example Session → thread → messages), not just a row count. “53 messages exist on thread X; its Session ownership is unchecked” is evidence; “Session Y lost its messages” is not established by that count.

Source edits go in a task worktree (`ab task start <name>`, then `update_environment_directory`; `ab task finish` integrates into the canonical checkout and cleans up); the task extension refuses interactive edits in the canonical checkout. Tracker writes go through the tracker CLI, which commits only its own paths.
