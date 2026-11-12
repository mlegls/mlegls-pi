---
stage: "done"
assignee: "agent"
author: "session:import-hermes-sessions-as-a-lifes-first-messages-drive-3"
---
While driving [[projects/mlegls-pi/issues/import-hermes-sessions-as-a-lifes-first-messages]], `bun ~/.pi/agent/skills/tracker/scripts/issues.ts outline` from its linked worktree exited 1: `no vault note has directory: /home/mlegls/dev/mlegls-pi`. No outline was available. `snapshot --json` worked as a workaround to search existing issue slugs. Owning tool: mlegls-pi tracker skill. This is an observed setup friction; whether a vault note should be restored or the command should degrade gracefully remains open.

## Result

Accepted limitation. outline reconciles the project's vault note and needs a note whose directory is the repo root; none exists on this host (reproduces from the main checkout too, not a worktree effect). The error names the cause, and workers use snapshot/tree/frontier, which work. Whether to restore the vault note is the maintainer's machine setup, not a tracker defect.
