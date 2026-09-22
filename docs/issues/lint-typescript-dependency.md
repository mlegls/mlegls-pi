---
stage: ticket
assignee: agent
priority: 3
---

lib/lint/extract.ts imports TypeScript and resolves it from the target repository, but package.json does not declare it. A fresh friction-fixes checkout failed typechecking with TS2307 plus consequent implicit-any errors. A temporary worktree-local TypeScript 5.9.3 from the existing Bun cache made typecheck and Jev lint pass. Declare the lint tooling dependency so a normal setup suffices; do not depend on bunx having cached a compiler. Observed during September 21 friction fixes.
