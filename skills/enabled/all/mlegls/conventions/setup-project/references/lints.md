# Lint configurations

Two kinds of check, by what a violation means.

Honesty, as errors: `any`, casts, non-null assertions, unnecessary
conditions, `unwrap`, dead code, unused exports and dependencies, barrels.
Each forbids lying to the checker, and the fix is the honest version.

Size, as a separate on-demand run (`inventory` script, source dirs only):
per-function complexity, depth, length. Where to read first, not a gate:
gated, they are causal Goodhart, since the cheapest fix is extract-a-helper,
which adds a name and removes nothing. Off the ordinary lint run, so a
hundred warnings do not ride along with every check.

The gate is totals over the scope, which splitting cannot lower:
[scc-delta.sh](lints/scc-delta.sh) prints code and complexity of the working
tree against a ref (`scc` via `mise use ubi:boyter/scc`, `jq`). `simplify`
requires both to go down with every story holding; `implement` reports them,
and growth beyond what the behavior warranted is a friction. Co-change
(`project-docs`' `cochange.ts`) is the same kind of measure for the tree.

Starting configurations for the project's existing lint/check setup:

- TypeScript: [Oxlint](lints/typescript/.oxlintrc.json),
  [inventory](lints/typescript/.oxlintrc.inventory.json) and
  [Knip](lints/typescript/knip.json). Bun dependencies:
  `bun add -D oxlint oxlint-tsgolint knip`; commands: `oxlint --type-aware`,
  `oxlint -c .oxlintrc.inventory.json src`.
- Rust: [Cargo lints](lints/rust/Cargo-lints.toml) and
  [Clippy](lints/rust/clippy.toml). Commands: `cargo clippy`, `cargo machete`;
  the size lints are `warn` there, so `cargo clippy -- -A warnings` is the
  ordinary run and plain `cargo clippy` the inventory.
- Go: [golangci-lint v2](lints/go/.golangci.yml).
  Dependency check: `go mod tidy -diff`. Size linters carry `warning`
  severity; run with `--severity error` ordinarily.

Install the selected configuration into the repository's ordinary checks,
hooks, and CI as requested. Existing tool choices and rules determine which
parts of these starting configurations apply.
