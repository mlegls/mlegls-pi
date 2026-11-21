---
name: orient
description: "Use when arriving at a project or asking where things stand and what to do next."
argument-hint: "an issue subtree, or nothing for the project"
---

At entry, run `bun ~/.pi/agent/skills/tracker/scripts/issues.ts lint [slug]` and `bun ~/dev/mlegls-pi/lib/views.ts` from the project. Reconcile triage signals before selecting work (lint errors mean unavailable evidence).

The views are current as of their timestamp; narrate over them instead of recomputing them. Read what they cannot tell: issue bodies (`tracker`), stories for the top items, recent git landings, and live sessions/worktrees behind claims. Stay read-only: no claims, edits, or launches.

Orient within the requested subtree (or whole project): ongoing scopes and their live supervisors, what landed and was verified, what remains, unowned ready work, and questions needing the user ranked by priority and transitive unblocks. Separate recorded state, observed contradictions, and unknowns.

Name `inflight:` claims (`derived: true`) as dispositions, not ready work: `orphaned` (owner gone; parent or user resumes its supervisor), `waiting` (wake idle owner), or collector-landed (pending merge up the chain, not global done). Leave supervisors you don't own alone.

Return an overview, ready work grouped by code area, hygiene findings (check, stale claims, outline drift), a recommended next entry (resume/start a supervisor, or advance a scope), and source references. Ready implementation belongs to a supervisor, even for a single ticket; direct execution here requires an explicit user choice.

End the turn with the briefing; it is a natural point to compact and switch model. Before acting on it later, `show.raw(views.diff(state.views, views.snapshot()))` shows what changed since.
