---
stage: spec
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

substeps: [[projects/mlegls-pi/issues/dsh-hashline-tools-spike]] first; it settles package layout and loading. Then in parallel [[projects/mlegls-pi/issues/dsh-scratch-state]], [[projects/mlegls-pi/issues/dsh-skim-run-code-results]], [[projects/mlegls-pi/issues/dsh-ptc-shell-and-transform-edits]], [[projects/mlegls-pi/issues/dsh-memory-compaction-provider]], [[projects/mlegls-pi/issues/dsh-board-host]]; then [[projects/mlegls-pi/issues/dsh-templated-spawn-and-dispatch]].

Outside this tree (need shaping): [[projects/mlegls-pi/issues/project-scoped-sessions-and-worktrees]], [[projects/mlegls-pi/issues/dsh-supervision-tree-ui]], [[projects/mlegls-pi/issues/skim-friction-vs-savings]].

decisions:
- 2026-09-27: plugins live in this repo under `dsh/`, wrapping `lib/` code rather than forking it; pi extensions keep working alongside.
- 2026-09-27: the exec kernel is not ported. PTC replaces it; live state moves to host services exposed as tools, with handle ids in programs. A live-object kernel (DOM, dataframes across cells) is a separate Jupyter-style tool only if needed.
- 2026-09-27: multiagent coordination is captured as few orthogonal primitives: templated spawn, pubsub, and monitor (the host posts lifecycle events to a child's topic, since a crashed process can't announce its own exit). Concurrency limits are an admission policy on spawn; fork/join is spawn + waiting on the child's topic. Utilities for typical patterns sit on top. (Same decomposition as Erlang/OTP spawn, pg, monitor, supervisors; AutoGen 0.4's core runtime is topics + subscriptions + agent factories.)

shape: `dsh/` holds one Cordis plugin package per capability plus `dsh/cordis.yml`, the overlay that inserts them and restricts the defaults they replace. Usage is `dsh web --patch $PWD/dsh/cordis.yml`.
