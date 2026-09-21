---
name: mlegls-pi
description: "Use when editing this package from any session: repo layout, adding or overriding an exec module, testing and reloading."
---

canonical checkout `~/dev/mlegls-pi`. worktrees under `~/dev/mlegls-pi__worktrees/`. pi-package: `extensions/`, `lib/`, `skills/{pi,mlegls-pi}`, `prompts/`, `themes/`. user skills `skills/{enabled,disabled}`, `agents/`, `agent-prompts/` (system-config symlinks these and runs agents-apply). cell API: `extensions/exec/README.md`.

exec cell: `lib/<name>.ts` is `<name>` (not names already in the cell API). `.pi/exec/<name>.ts` in the project shadows that file; a stem that isn't in lib is `project.<name>`. upstream by moving the file to `lib/`.

add or override: write `.pi/exec/<name>.ts`, `/exec-reset`. try it in a cell, then `bun test extensions/exec`. `bunx tsc --noEmit` currently fails in session/system-prompt; those are pre-existing.

kernel reload: `/exec-reset` or a new session. a running kernel keeps the modules it started with.

host hooks: `lib/<name>/host.ts` exports a default Pi extension factory and is explicitly listed in `package.json` under `pi.extensions`. Pi owns per-extension installation and failure isolation. `/reload` or restart Pi after changing host code. `extensions/disabled/` holds archived adapters.

## hosts

inside Orca, exec keeps `board` and defaults `wm` off; `dispatch.dispatch` launches Orca workers. `/fork-tab [title]` opens the current conversation in another tab. See `docs/orca.md`.
