# Orientation and interactive roles

Advancing spends the user's attention; supervision spends compute.

- `introduce` is the intake check whenever the user says something about the project should change: find the story it serves, question the premise, find existing records, then update the story and either implement a settled session-sized change or record an issue.
- `orient` answers where things stand and what to enter next. `advance` reads its scope through it.
- `advance` makes progress on an issue or scope by its status and the rest of the tracker: shaping what isn't ready (triage for the most ready work per user decision, then, unscoped, areas ranked by importance and leverage for the user to pick and fork, then `shape` to spec), and handing what is ready to an execution supervisor (`tend`) in its own session, so interactive sessions stay interactive.
- `shape` drives an issue toward executable contracts, using map and plan.
- `supervise` owns an agent-ready subtree through execution: it starts a reconciler (`lib/reconcile`) on it, which gets specs to tickets, runs each ticket through implement → drive → review and integrates upward, and resolves the exceptions the reconciler's handlers could not.

Campaigns are ordinary parent issues. Supervision starts only on agent-ready subtrees and commits to finishing them; shaping refines or moves out everything else first. Questions a handler cannot answer within its node's authority go up to the next ancestor's handler, and at the root to the supervisor and then the user. Shared truth is in tickets/docs, working context in session/OM, and execution state in durable orchestration records.

## Preparation

Orientation happens in the interactive session itself, not in a delegated reader. The `orient` skill takes a [views](../lib/views.ts) snapshot (tracker frontier/mine/check/outline from the tracker skill's CLI, git state, worktrees), reads what the views cannot tell, and writes the briefing. `views.diff(state.views, views.snapshot())` reruns the snapshot and reports the lines that changed, so a briefing's age is measurable instead of narrated.

The briefing is read-only, not permission to execute a recommendation. Orient reports progress, known supervisors, ready unowned work and a leverage-ranked human queue. It does not silently become a local implementation session.

With observational memory, compaction after the reading costs the parent nothing, so the reads need no isolation; the briefing is a natural point to compact and switch model. Broad or web evidence can go to a `research` worker, which returns compressed findings with sources.

## Verification

An orientation over a specified ticket should locate it within the scope and recommend an entry, not command its implementation. A workflow discussion should remain a discussion even when related executable tickets exist. An introduction updates the story before any implementation, and implements only a settled session-sized change. Orientation leaves the tracker unchanged.
