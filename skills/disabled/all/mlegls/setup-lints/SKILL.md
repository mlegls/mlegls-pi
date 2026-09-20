---
name: setup-lints
description: "Use for /setup-lints, when lint gates are missing, or when a recurring correction could become a rule."
---

A lint gate is executable memory of a useful correction. Start from something
observed in model-written code, not an imagined failure catalogue.
`evaluate-lints` explains the design signals worth preserving.

1. Extend the project's existing tooling. The language references below are
   starting configurations, not a reason to install a competing linter.
2. Demonstrate the rule on real code or a small specimen. The ordinary fix
   should improve the representation or remove code, not game the metric.
3. Establish a baseline the project can adopt. Clean rules can gate now;
   existing debt can have a visible bound that tightens as it is removed.
4. Show the proposed rules, baseline, and enforcement changes for confirmation
   (`grilling`), then wire them into `lint`, hooks, and CI as agreed. Keep
   configuration separate from the fixes it prompts.

Reader-load and dependency-count instruments are useful for inspection, not
automatic architectural verdicts. Add them when a real question needs them.

## Language references

- TypeScript: [oxlint](references/typescript/.oxlintrc.json) and
  [knip](references/typescript/knip.json). With Bun:
  `bun add -D oxlint oxlint-tsgolint knip`; `oxlint --type-aware`.
  `complexity` and `max-depth` approximate cognitive complexity in oxlint.
- Rust: merge [Cargo lints](references/rust/Cargo-lints.toml) and
  [Clippy config](references/rust/clippy.toml). `cargo clippy` checks code;
  `cargo machete` checks unused dependencies. `dead_code` misses unused public
  library exports.
- Go: [golangci-lint v2](references/go/.golangci.yml), with Staticcheck's `S1*`
  simplifications. `unused` misses exports; the Go `deadcode` tool can inspect
  those. `go mod tidy -diff` checks dependency drift.

A new language reference belongs here once its configuration has been tried,
not merely inferred from another tool's rule names.
