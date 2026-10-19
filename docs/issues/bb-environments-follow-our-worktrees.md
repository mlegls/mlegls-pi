---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/retire-the-ab-thread-registry]]"
---
bb's environment for each worker worktree reflects its merge target and goes away with it.

Done:
- At spawn, wm sets the environment's `merge_base_branch` from `branch.<b>.ab-parent` (`bb environment update --merge-base-branch`), so bb's diff compares against the real merge target.
- After retirement removes a worktree, it deletes the bb environment. First check on one stale environment what `bb environment delete` does to an attached checkout whose folder is gone (no error, no thread lost).
- A one-off sweep deletes the ~1,071 ready environments whose path no longer exists, across projects; report the count.

## Independent verification

[CLI evidence packet](../attachments/bb-environments-follow-our-worktrees/index.md), [drive log](../attachments/bb-environments-follow-our-worktrees/drive.md), commit `8ac87aed`: 1,101 historical destroyed rows corroborated and probe threads preserved. Live supervisor-created driver had null merge base despite recorded ab-parent; retired implementer left one ready missing-path environment. Runtime provenance is unknown; changed checkout-local spawn/retire still needs driving before acceptance. Test-only handoff friction added to [[projects/mlegls-pi/issues/mail-drive-handoff-names-only-a-test-runner]].
