---
stage: spec
assignee: agent
priority: 3
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

Make the repository's test commands mean what they say. Today `bun test ab` or a root `bun test` pick up disabled skills and the optional `dsh/` package, worktree tests read the canonical checkout's agent roster, and a rejection test can launch a real worker when its guard regresses. Each is a false failure or a hazard that reviewers work around by hand. Each child states its own contract.

Done when `ab check -- bun test` in a fresh worktree after `bun run setup` fails only on real defects (list any remaining known failures in the result), and every child is done.
