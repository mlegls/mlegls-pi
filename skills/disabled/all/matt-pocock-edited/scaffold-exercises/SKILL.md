---
name: scaffold-exercises
description: "Use when scaffolding exercises or a new course section."
---

Create exercise structures that pass `pnpm ai-hero-cli internal lint`, then commit.

Layout: sections are `exercises/XX-section-name/`, exercises `XX.YY-exercise-name/` inside them, dash-case. Each exercise needs at least one of `problem/` (student workspace with TODOs), `solution/`, `explainer/` (no TODOs) — default to `explainer/` when stubbing. Each variant folder needs a non-empty `readme.md` with no broken links (a stub `# Title` + description line suffices); folders with code also need a `main.ts` (>1 line), but readme-only stubs are fine.

Workflow: parse the plan → `mkdir -p` → stub readmes → run lint → fix until it passes.

Lint also forbids: `.gitkeep`, `speaker-notes.md`, `pnpm run exercise` commands in readmes; it requires at least one of `problem/`/`explainer/`/`explainer.1/` per exercise.

When renumbering or moving: `git mv` (never `mv`), update the numeric prefix, re-run lint.
