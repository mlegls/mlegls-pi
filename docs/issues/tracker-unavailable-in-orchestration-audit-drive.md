---
stage: ticket
priority: 3
assignee: agent
---

# Tracker unavailable in orchestration-audit drive

Owner: mlegls-pi worker tool provisioning / tracker entry point.

Observed on 2026-09-30 in worktree `role-model-spikiness-drive`: the assignment requires filing tooling friction through `tracker`, but `command -v tracker` found no executable. Tried `ab lib tracker` and `bun /Users/mlegls/dev/mlegls-pi/lib/tracker.ts --help` as alternative entry points: both reported module not found. These probes establish that those entry points were unavailable, not that no tracker implementation exists elsewhere.

Workaround: recorded this issue as a Markdown ticket in the local repository and linked it from the [drive packet](../attachments/role-model-spikiness/index.md). No product repairs or canonical-checkout edits.

Possible improvement: supply the runnable tracker entry point in worker setup or ensure the required command is on the worker's PATH.
