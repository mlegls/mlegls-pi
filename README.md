# mlegls-pi

Personal exec libraries, skills, prompts, themes, agents, and user-level harness skills.

Exec-facing capabilities install their host integrations through explicit
`install(host)` exports in `lib/*/host.ts`; obsolete adapters live in
`extensions/disabled/`. Memory, featherless, fence, system-prompt, and workspace commands remain
standalone extensions for their Pi-facing commands and providers. See [host libraries](extensions/exec/README.md#host-libraries).

[Memory](extensions/memory/README.md) provides one-shot append-only compaction and original-turn recall. Connectome remains available in `extensions/connectome/` but is not loaded by default; do not enable both compaction backends.


Interactive work: `introduce` establishes intent, `orient` finds the next entry, `shape` makes tickets ready, and `supervise` carries a scope through verification. See [delivery](docs/delivery.md), and [session preparation](docs/session-preparation.md).

## Local execution resources

`ab check -- bun-axi run typecheck` admits a heavy command through the per-user
daemon's two-slot queue, independent of orchestration budgets. Wrap existing
checks without changing their cadence. Children share the slot; commands that
bypass the wrapper remain unconstrained.

`ab check --share INPUT-IDENTITY -- COMMAND...` coalesces overlapping checks on
the same frozen clean revision. The identity must also cover ignored inputs and
environment; this is opt-in singleflight, not a result cache. See `ab check --help`.

`ab service start -- COMMAND...` runs a foreground dev server with an explicit
stop ID and a default 30-minute lifetime. Stop it after the drive, even on
failure; retain the setup recipe rather than the resident environment. These
services aren't check jobs and don't consume the two slots.

The commands require a daemon started from this version. An already-running
daemon must be restarted at a safe orchestration boundary; upgrading the source
does not restart it or change existing executions. See `ab service --help` for
process-group and crash-cleanup limitations.

## Development

With Bun available, run `bun run setup`, then `bun test`. Tracker CLI tests: `bun run test:tracker`.
Setup installs the root, outline-read, disabled LSP, and tracker-script dependencies from
committed lockfiles. Each checkout gets its own node_modules; Bun’s package cache
is shared, not mutable dependency directories from another checkout.
The root install suppresses lifecycle scripts, so worktree setup cannot rebuild or
re-sign the desktop helper. Native permission setup is explicit via
`/computer-use setup`; see the exec documentation before changing helper identity.

Workmux runs the same setup automatically before starting a new worker.
Plain git worktrees and existing worktrees use `bun run setup` explicitly.
Disabled Firecrawl and MCP packages are optional and not required by the suite;
install their dependencies separately if enabling them.
The independent optional [dsh overlay](dsh/README.md) is also excluded from root
`bun test` discovery; root setup does not install it. To develop it, run
`bun run --cwd dsh setup`, then `bun test --cwd dsh` separately.

See [exec](extensions/exec/README.md) for the TypeScript cell API.
Workers run as `wm` workers (workmux worktree + tmux window) and report over the board.

See [Featherless](extensions/featherless/README.md) for automatic model discovery.

## User skills, agents, prompts

User skills live under `skills/{enabled,disabled}/{all,claude,codex,pi}`, worker agents under `agents/`, and shared harness prompts under `agent-prompts/`. `~/.config/system-config` keeps symlinks to those trees; `scripts/agents-apply.sh` there installs them into Claude, Codex, and Pi. Package skills are only `skills/enabled/pi/pi` and `skills/enabled/pi/mlegls-pi`; the enabled/disabled trees are not also loaded as package skills. Keep `package.json` valid JSON: Pi falls back to scanning all of `skills/` if it cannot parse the manifest.
