# Orientation and interactive roles

Advancing spends the user's attention; supervision spends compute.

- `introduce` is the intake check whenever the user says something about the project should change: find the story it serves, question the premise, find existing records, then update the story and either implement a settled session-sized change or record an issue.
- `orient` answers where things stand and what to enter next. `advance` and `supervise` read their scope through it.
- `advance` moves ideas toward agent-ready tickets: triage for the most tickets per user decision, then (unscoped) areas ranked by importance and leverage for the user to pick and fork, then `shape` on each chosen scope.
- `shape` drives an issue toward executable contracts, using map and plan.
- `supervise` owns an agent-ready subtree through implementation, verification and reconciliation. It dispatches child supervisors for non-leaf children and implementation workers for leaves; each level integrates and verifies its subtree before reporting up.

Campaigns are ordinary parent issues. Supervision starts only on agent-ready subtrees and commits to finishing them; shaping refines or moves out everything else first. Questions a supervisor cannot answer within its authority go up to its parent, and at the root to the user. Shared truth is in tickets/docs, working context in session/OM, and execution state in durable orchestration records.

## Preparation

Orientation happens in the interactive session itself, not in a delegated reader. The `orient` skill takes a [views](../lib/views.ts) snapshot (tracker frontier/mine/check/outline from the tracker skill's CLI, git state, worktrees), reads what the views cannot tell, and writes the briefing. `views.diff(state.views, views.snapshot())` reruns the snapshot and reports the lines that changed, so a briefing's age is measurable instead of narrated.

The briefing is read-only, not permission to execute a recommendation. Orient reports progress, known supervisors, ready unowned work and a leverage-ranked human queue. It does not silently become a local implementation session.

With observational memory, compaction after the reading costs the parent nothing, so the reads need no isolation; the briefing is a natural point to compact and switch model. Broad or web evidence can go to a `research` worker, which returns compressed findings with sources.

## Verification

An orientation over a specified ticket should locate it within the scope and recommend an entry, not command its implementation. A workflow discussion should remain a discussion even when related executable tickets exist. An introduction updates the story before any implementation, and implements only a settled session-sized change. Orientation leaves the tracker unchanged.

The older selection pipeline's observations are retained in [2026-09-20 verification](research/session-preparation-2026-09-20.md); they are not verification of the current orientation-only policy.
