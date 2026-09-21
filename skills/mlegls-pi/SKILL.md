---
name: mlegls-pi
description: "Use when editing this package from any session: repo layout, adding or overriding an exec module, testing and reloading."
---

canonical checkout `~/dev/mlegls-pi`. worktrees under `~/dev/mlegls-pi__worktrees/`. pi-package: `extensions/`, `lib/`, `skills/{pi,mlegls-pi}`, `prompts/`, `themes/`. user skills `skills/{enabled,disabled}`, `agents/`, `agent-prompts/` (system-config symlinks these and runs agents-apply). cell API: `extensions/exec/README.md`.

exec cell: `lib/<name>.ts` is `<name>` (not names already in the cell API). `.pi/exec/<name>.ts` in the project shadows that file; a stem that isn't in lib is `project.<name>`. upstream by moving the file to `lib/`.

add or override: write `.pi/exec/<name>.ts`, `/exec-reset`. try it in a cell, then `bun test extensions/exec`. `bunx tsc --noEmit` currently fails in session/system-prompt; those are pre-existing.

kernel reload: `/exec-reset` or a new session. a running kernel keeps the modules it started with.

host hooks: `lib/<name>/host.ts` exports `install(host: ExtensionAPI)`. exec discovers these once at extension load. `/reload` or restart Pi after changing host code. `extensions/disabled/` holds standalone adapters; the package loads only `extensions/exec/index.ts`.

## hosts

under bb (`BB_THREAD_ID` set), exec's `board` and `wm` modules are off by default and the board host installer is inert; bb's thread commands replace them (see the multi-agent skill). `--exec-modules board,wm` re-enables them there.
