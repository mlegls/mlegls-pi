---
stage: goal
assignee: human
author: session:01a12f4c-1aa6-75fe-9c2b-d81acad80dbd
part-of: "[[projects/mlegls-pi/issues/reconcile-github-tracked-projects]]"
blocked-by: ["[[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]]"]
priority: 2
---

A GitHub backend for the `Tracker` interface of [[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]], over the model in [issue-tracker-github](../../skills/enabled/all/mlegls/conventions/tracker/references/issue-tracker-github.md): sub-issues for part-of, native `blocked_by` dependencies, assignees.

holes:
- labels for what the GitHub reference doesn't map yet: `stage:*`, `drive: none`, `claimed-by` (assignee, or an `inflight` label), move-out.
- identity: issue numbers as slugs in handles, state file names and dispatch records (`gh-123`?).
- one GraphQL query per subtree snapshot, cached across ticks, against rate limits.
- where a result's verification evidence goes when the repository doesn't want `docs/attachments/`: a PR or issue comment.
- whether refinement may create sub-issues during a run at all on a public tracker, where others see them at once.
