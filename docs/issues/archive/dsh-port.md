---
stage: done
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
priority: 2
---

The capabilities of this repo that are expected to beat harness defaults, running as Cordis plugins in [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) and loaded as a `dsh web --patch` overlay, so the same working style is available in its web/desktop app:

- filtered/skimming read
- hashline read/write/edit
- autobiographical memory
- pubsub inter-agent comms, integrated with the supervision tree
- auto-dispatching delegation with subagent presets

Beyond those, the point is an outer loop where the agent can express big intentions all at once and without friction. dsh's programmatic tool calling (PTC, `tools: { mode: ptc }`) is what `extensions/exec` wanted to be; RPC-based communication was the workaround for pi's architecture. Every nested call goes through the full tool pipeline and is logged as `tool/ptc-dispatch`, but each program starts without state and bindings are JSON-in/JSON-out registered tools.

dsh is a developer preview with announced breaking changes. The source is cloned at `~/dev/deepseek-harness` (commit 477b4f4, 2026-09-24). The built CLI in the bun cache via `bunx` is `@deepseek-ai/dsh` 0.1.5, older than that commit; npm has 0.1.7-rc.2. Its extension API is Cordis (`apply(ctx)`, scoped side effects, HMR); start from `docs/cookbook/extension-cookbook.md`, `docs/capability-seams.md`, `docs/subsystems/ptc-runtime.md` and `docs/user/develop/basic/`.

substeps: [[projects/mlegls-pi/issues/archive/dsh-hashline-tools-spike]] first; it settles package layout and loading. Then in parallel [[projects/mlegls-pi/issues/archive/dsh-scratch-state]], [[projects/mlegls-pi/issues/archive/dsh-skim-run-code-results]], [[projects/mlegls-pi/issues/archive/dsh-ptc-shell-and-transform-edits]], [[projects/mlegls-pi/issues/archive/dsh-memory-compaction-provider]], [[projects/mlegls-pi/issues/archive/dsh-board-host]]; then [[projects/mlegls-pi/issues/archive/dsh-templated-spawn-and-dispatch]].

Outside this tree (need shaping): [[projects/mlegls-pi/issues/project-scoped-sessions-and-worktrees]], [[projects/mlegls-pi/issues/archive/dsh-supervision-tree-ui]], [[projects/mlegls-pi/issues/archive/skim-friction-vs-savings]].

decisions:
- 2026-09-27: plugins live in this repo under `dsh/`, wrapping `lib/` code rather than forking it; pi extensions keep working alongside.
- 2026-09-27: the exec kernel is not ported. PTC replaces it; live state moves to host services exposed as tools, with handle ids in programs. A live-object kernel (DOM, dataframes across cells) is a separate Jupyter-style tool only if needed.
- 2026-09-27: multiagent coordination is captured as few orthogonal primitives: templated spawn, pubsub, and monitor (the host posts lifecycle events to a child's topic, since a crashed process can't announce its own exit). Concurrency limits are an admission policy on spawn; fork/join is spawn + waiting on the child's topic. Utilities for typical patterns sit on top. (Same decomposition as Erlang/OTP spawn, pg, monitor, supervisors; AutoGen 0.4's core runtime is topics + subscriptions + agent factories.)
- 2026-09-27: run the npm `@deepseek-ai/dsh` **0.1.7-rc.2** distribution, not cached bunx 0.1.5 or a build of clone 477b4f4. `dsh/package.json` and `dsh/bun.lock` are an independent private package, **not a Bun workspace**; `@deepseek-ai/dsh-tools` is also pinned to 0.1.7-rc.2, Cordis to 4.0.4. Runtime imports resolve from `dsh/node_modules`. Capability modules live under `dsh/<capability>/`; Bun bundles their relative `../../lib/` imports into ignored `dsh/dist/` with external packages left external. Root pi dependencies remain required by the shared edit implementation. `bun run --cwd dsh setup` installs the lock and builds; put `$PWD/dsh/node_modules/.bin` on PATH to run the pinned CLI.
- 2026-09-27: the spike's overlay registers hashline tools at host level, keeps ledgers per live agent, and selects a minimal `hashline` PTC preset instead of the shipped presets. `tool-fs`, `tool-str-replace-editor` are not mounted, and `fs-observation-policy` is disabled. Existing-file mutations use `edit`; `write` exclusively creates new files. Anchors are not durable across restart/HMR: reread first. Nested local preset plugin loading friction: [[projects/mlegls-pi/issues/archive/dsh-preset-relative-plugin-loading]].

shape: `dsh/` holds one Cordis plugin module per capability plus `dsh/cordis.yml`, the overlay that inserts them and omits the defaults they replace. Usage is `dsh web --patch $PWD/dsh/cordis.yml`; see `dsh/README.md` for setup and the first PTC program.

review boundaries: one, at this root, over the combined delta from 19cc62b, owned by the root supervisor, before reporting to the user. The reviewer gets extra attention on persistence and replay ([[projects/mlegls-pi/issues/archive/dsh-memory-compaction-provider]], [[projects/mlegls-pi/issues/archive/dsh-scratch-state]]) and concurrency/shared state ([[projects/mlegls-pi/issues/archive/dsh-board-host]], since pi and dsh sessions share one board store). The spike's layout contract isn't reviewed separately; dependents build on its recorded decisions and report friction with it.

Related upstream frictions found along the way: [[projects/mlegls-pi/issues/archive/dsh-web-default-workspace-outside-home]], [[projects/mlegls-pi/issues/archive/dsh-web-deepseek-extension-preparation-fails]].

## Root review

[Combined delta review and live integration check](../attachments/dsh-port-root-review/index.md).
