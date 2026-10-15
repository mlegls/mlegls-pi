---
stage: spec
assignee: agent
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

- 2026-10-14: issue identity is `gh-<number>` in handles, state file names and dispatch records; a run touches one repository (maintainer).
- 2026-10-14: `drive: none` is a `no-drive` label, set by refine. Move-out removes `ready-for-agent`, adds `ready-for-human` with a comment giving the reason, and unassigns the run (maintainer).
- 2026-10-14: evidence stays committed under `docs/attachments/` on the branch; the closing comment links it. A repository whose `docs/agents/issue-tracker.md` declines attachments gets the evidence in the closing comment instead (maintainer).
- 2026-10-14: one GraphQL query per run snapshot (sub-issues, blockedBy, labels, assignees, bodies), cached between ticks, refreshed after the reconciler's own writes or after about a minute, against rate limits (maintainer).
- 2026-10-14: webapp is the first real user (maintainer).

The backend lives behind the existing `Tracker` interface and implements the same CLI verbs (`snapshot`, `text`, `fields`, `create`, `update` with optional body, `close`, `remove` as close-as-not-planned since GitHub deletion needs admin), selected when the project has no `docs/issues/` and its `docs/agents/issue-tracker.md` names GitHub. Triage roles come from the repository's `docs/agents/triage-labels.md` table. Blocked-by uses native dependencies, falling back to a `Blocked by: #n` body line where the convention says so; part-of uses sub-issues, falling back to `Part of #n`. Under a PR landing, the PR body carries `Closes #…` for every node in the tree; nodes still close only after the merge is proven, as on the vault.

acceptance: on the private scratch repository mlegls/reconcile-pr-transport-20261014-35767b2d (reuse it; create no other repositories), with GitHub issues: a `ready-for-agent` spec with two sub-issue tickets, b blocked by a, and an outside issue blocked by a.
- reconcile in `pr-merge`: claims by assignment, b starts after a lands in the collector while GitHub shows both open, one PR whose body closes the spec and both tickets, and after merge a, b and the spec are closed child-first with an evidence-linked comment and the outside issue unblocked.
- a `ready-for-agent` issue without sub-issues is refined into either sub-issue tickets or a ticket; a refine that fails leaves its provisional sub-issues closed as not planned.
- snapshots stay within one GraphQL query per refresh across a run (count recorded in evidence).
