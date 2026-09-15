# mlegls-pi

Personal extensions, skills, prompts, and themes for pi.

## Development

With Bun available, run `bun run setup`, then `bun test`.
Setup installs the root, outline-read, and disabled LSP test dependencies from
committed lockfiles. Each checkout gets its own node_modules; Bun’s package cache
is shared, not mutable dependency directories from another checkout.
The root install suppresses lifecycle scripts, so worktree setup cannot rebuild or
re-sign the desktop helper. Native permission setup is explicit via
`/computer-use setup`; see the exec documentation before changing helper identity.

Workmux runs the same setup automatically before starting a new worker.
Plain git worktrees and existing worktrees use `bun run setup` explicitly.
Disabled Firecrawl and MCP packages are optional and not required by the suite;
install their dependencies separately if enabling them.

See [exec](extensions/exec/README.md) for the persistent TypeScript tool API.
