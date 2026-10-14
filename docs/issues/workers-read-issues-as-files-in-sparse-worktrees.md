---
stage: "idea"
assignee: "agent"
author: "session:01a12f4c-1aa6-75fe-9c2b-d81acad80dbd"
---
A reviewer in land-reconciled-trees-through-pull-requests (999c9602) reported it could not read a friction issue "because docs/issues is excluded from this worktree's checkout", instead of reading it with `issues.ts text <slug>`. Sparse worker worktrees have no `docs/issues/` by design (reconcile-against-a-global-tracker); the role prompts and tracker skill should make the CLI the only way agents read issues, e.g. one line in the worker preamble: issues are read with `issues.ts text|fields|tree`, never as files.
