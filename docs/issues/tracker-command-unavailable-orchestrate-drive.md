---
stage: ticket
priority: 3
---

# Tracker command unavailable in worker shell

Owner: pi worker tooling / `tracker` command provisioning.

Observed during the orchestrate-rework-effect first-use drive on 2026-09-30 in `/Users/mlegls/dev/mlegls-pi__worktrees/orchestrate-rework-effect-drive`: `tracker --help` returned `bash: tracker: command not found` (exit 127), despite worker instructions requiring friction to be filed through `tracker`.

Workaround: recorded this issue directly under `docs/issues/` so the tooling observation has a durable home. Product verification can proceed without this command.

Proposed follow-up: provision the instructed command on worker PATH or document the intended available issue-filing interface.
