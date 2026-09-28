---
stage: idea
assignee: agent
author: "session:01a0e5e9-67b7-732e-90ce-7e6ac7a4ad76"
---

Worktrees that `ab supervise` creates for a ticket and its `-drive`/`-review-N` phases start with no dependencies installed. In Concept (2026-09-27/28, ~17 concurrent supervisors) most worktrees lacked `node_modules` and the per-prototype installs. They failed as `oxfmt` exit 127, "missing bun-types / vite/client", or a Jev lint crash in `ts.sys.readFile`. Each of those looked like a code or tool failure until someone ran the dependency half of `scripts/setup-worktree.sh` (root `bun install` plus `bun install --cwd prototypes/*`) by hand. Concept already declares its setup as `mise run setup` in AGENTS.md.

Done when supervise runs the project's declared setup when it creates a worktree, before the worker's first turn. At minimum that is the dependency install, and one failure is reported as a setup failure, not a worker failure. The deployment half of setup (Convex, ports) is heavier and can stay with the worker.

- 2026-09-16 (concept): a second form. Integrate rebases the review worktree onto main, and main had just added `json-p3` (lockfile change from another landing). The worktree kept its old install, so typecheck failed with TS2307. `bun install --frozen-lockfile` fixed it (1 package). Integrate should reinstall whenever the rebase changes the lockfile.
