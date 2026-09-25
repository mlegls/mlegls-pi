# mlegls-pi

Personal exec libraries, skills, prompts, themes, agents, and user-level harness skills.

Exec-facing capabilities install their host integrations through explicit
`install(host)` exports in `lib/*/host.ts`; obsolete adapters live in
`extensions/disabled/`. Connectome, featherless, fence, system-prompt, and workspace commands remain
standalone extensions for their Pi-facing commands and providers. See [host libraries](extensions/exec/README.md#host-libraries).

See [Paseo integration](docs/paseo.md) for native agents/workspaces and setup.

Interactive work: `introduce` establishes intent, `orient` finds the next entry, `shape` makes tickets ready, and `supervise` carries a scope through verification. See [delivery](docs/delivery.md), and [session preparation](docs/session-preparation.md).

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
Execution and messaging follow one host: `PI_EXECUTION_HOST=paseo|wm` chooses; otherwise `PASEO_AGENT_ID` → Paseo, else standalone workmux/board. Native hosts suppress wm/board hooks and instructions.

See [Featherless](extensions/featherless/README.md) for automatic model discovery.

## User skills, agents, prompts

User skills live under `skills/{enabled,disabled}/{all,claude,codex,pi}`, worker agents under `agents/`, and shared harness prompts under `agent-prompts/`. `~/.config/system-config` keeps symlinks to those trees; `scripts/agents-apply.sh` there installs them into Claude, Codex, and Pi. Package skills are only `skills/enabled/pi/pi` and `skills/enabled/pi/mlegls-pi`; the enabled/disabled trees are not also loaded as package skills. Keep `package.json` valid JSON: Pi falls back to scanning all of `skills/` if it cannot parse the manifest.
