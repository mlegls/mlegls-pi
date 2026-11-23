# Interactive roles and orientation

Advancing spends the user's attention; supervision spends compute.

- `introduce`: intake check whenever the user wants something about the project to change—find the story, question the premise, check existing records, then either do a settled session-sized change or record an issue (`ready` if settled, `idea` if not).
- `orient`: read-only snapshot of where things stand and what to enter next (progress, active supervisors, ready unowned work, leverage-ranked human queue).
- `advance`: moves an issue or scope forward via `orient`—triages unready work for the highest ready yield per user decision, runs `shape` until agent-ready, and hands ready work to an execution supervisor (`tend`) in its own session so interactive sessions stay interactive.
- `shape`: drives an issue to `ready` (settled behavior, UX drawings if visual, and `decompose: true` if too big for one session).
- `supervise`: owns an agent-ready subtree via the reconciler (`lib/reconcile`), which decomposes `decompose: true` issues, runs each leaf through `implement → (drive) → review`, integrates upward, and resolves exceptions handlers couldn't.

Campaigns are ordinary parent issues. Unready subtrees go through shaping or move-out before supervision starts. Escalations climb to the ancestor handler, then the supervisor, then the user. Shared truth lives in issues and docs, working context in the session/OM, execution state in reconciler records.

## Preparation

`orient` runs directly in the interactive session using [lib/views.ts](../lib/views.ts) (tracker frontier/mine/check/outline, git status, worktrees) plus whatever the views don't show. `views.diff(before, views.snapshot())` checks what changed since an earlier snapshot.

Because observational memory makes post-read compaction cheap, local reads need no reader subagent; a briefing is a natural point to compact or switch models. Delegate only broad or web evidence gathering to a `research` worker.
