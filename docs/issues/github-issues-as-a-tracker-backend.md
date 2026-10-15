---
stage: goal
assignee: human
author: session:01a12f4c-1aa6-75fe-9c2b-d81acad80dbd
part-of: "[[projects/mlegls-pi/issues/reconcile-github-tracked-projects]]"
blocked-by: [ "[[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]]" ]
priority: 2
---

A GitHub backend for the `Tracker` interface of [[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]], over the model in [issue-tracker-github](../../skills/enabled/all/mlegls/conventions/tracker/references/issue-tracker-github.md): sub-issues for part-of, native `blocked_by` dependencies, assignees.

decisions:
- 2026-10-14: support the mattpocock/skills GitHub convention as used in simple-compute-market and webapp (`docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`): `wayfinder:map` + sub-issues, `wayfinder:<type>` children, native `blocked_by`, triage roles mapped through the repo's `triage-labels.md` table, not hard-coded label strings (maintainer).
- 2026-10-14: a run claims an issue by assigning it (the convention's claim: `--add-assignee @me`); the convention's frontier already drops assigned issues. Which run holds it lives in reconciler state (maintainer).
- 2026-10-14: refinement creates children during a run as on the vault, in every repository, no per-repo difference. No node may decrease in effective readiness: a refine may not add a child less ready than the node it refines. `lib/reconcile/refinement.ts` already refuses a refinement that lowers the effective stage, through the Tracker interface, so the GitHub backend inherits it (maintainer).

- 2026-10-14: no `stage:spec` label; stages are inferred from the convention as mattpocock's `to-spec` / `to-tickets` write them. A `ready-for-agent` issue with sub-issues is a partitioned spec and its sub-issues are tickets; a `ready-for-agent` issue without sub-issues enters as a spec, and refine either partitions it or promotes it to a ticket (`refinement.ts` already allows ticket promotion without children) (maintainer).
- 2026-10-14: the issue body (with comments) is the contract. No special support for OpenSpec or other linked documents: an agent that finds the body pointing elsewhere reads that document itself (maintainer).

holes:
- acceptance includes PR landing on a GitHub-tracked tree: the PR body carries `Closes #…` for every completed node, results are preserved, nothing closes before the merge (moved here from land-reconciled-trees-through-pull-requests).
- labels for what the GitHub reference doesn't map yet: `stage:*`, `drive: none`, `claimed-by` (assignee, or an `inflight` label), move-out.
- identity: issue numbers as slugs in handles, state file names and dispatch records (`gh-123`?).
- one GraphQL query per subtree snapshot, cached across ticks, against rate limits.
- where a result's verification evidence goes when the repository doesn't want `docs/attachments/`: a PR or issue comment.
- whether refinement may create sub-issues during a run at all on a public tracker, where others see them at once.
