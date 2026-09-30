---
stage: done
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
priority: 3
---

# Tracker command unavailable in worker shell

Owner: pi worker tooling / `tracker` command provisioning.

Observed during the orchestrate-rework-effect first-use drive on 2026-09-30 in `/Users/mlegls/dev/mlegls-pi__worktrees/orchestrate-rework-effect-drive`: `tracker --help` returned `bash: tracker: command not found` (exit 127), despite worker instructions requiring friction to be filed through `tracker`.

Workaround: recorded this issue directly under `docs/issues/` so the tooling observation has a durable home. Product verification can proceed without this command.

Proposed follow-up: provision the instructed command on worker PATH or document the intended available issue-filing interface.

Review note, 2026-09-30: `tracker` is a skill (`ab skill tracker`), not a PATH command; in this repo its vault adapter means filing is writing `docs/issues/<slug>.md`, which is what the workaround did. The friction that remains is the worker preamble's wording ("file … through `tracker`"), which reads as a CLI invocation. Proposed: name it as the `tracker` skill in the preamble.

Dedupe note, 2026-09-30: the role-model-spikiness drive hit the same friction and filed `tracker-unavailable-in-orchestration-audit-drive` as its fallback copy; that file is deleted and its packet link points here.

resolved, 2026-09-30: the worker preamble (`agents/_common.md`) and the review/consolidate roles now name the `tracker` skill and say there is no `tracker` command.
