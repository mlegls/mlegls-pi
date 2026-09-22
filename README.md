# mlegls-pi

Personal exec libraries, skills, prompts, themes, agents, and user-level harness skills.

Exec-facing capabilities install their host integrations through explicit
`install(host)` exports in `lib/*/host.ts`; obsolete adapters live in
`extensions/disabled/`. Featherless, fence, system-prompt, workspace, and Orca commands remain
standalone extensions for their Pi-facing commands and providers. See [host libraries](extensions/exec/README.md#host-libraries).

See [Paseo integration](docs/paseo.md) for native agents/workspaces and setup; [Orca](docs/orca.md) retains its host-local adapter and `/fork-tab`.

Interactive work: `introduce` establishes intent, `orient` finds the next entry, `shape` makes tickets ready, and `supervise` carries a scope through verification. See [workflows](workflows.md), [delivery](docs/delivery.md), and [session preparation](docs/session-preparation.md).

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

See [exec](extensions/exec/README.md) for the TypeScript cell API.
Execution and messaging are host-local: Paseo under `PASEO_AGENT_ID`, otherwise Orca inside its workspace environment, otherwise standalone wm/board. Native hosts suppress wm/board hooks and instructions.

See [Featherless](extensions/featherless/README.md) for automatic model discovery.

## User skills, agents, prompts

User skills live under `skills/{enabled,disabled}/{all,claude,codex,pi}`, worker agents under `agents/`, and shared harness prompts under `agent-prompts/`. `~/.config/system-config` keeps symlinks to those trees; `scripts/agents-apply.sh` there installs them into Claude, Codex, and Pi. Package skills are only `skills/pi` and `skills/mlegls-pi`, so the enabled/disabled trees are not also loaded as package skills.
