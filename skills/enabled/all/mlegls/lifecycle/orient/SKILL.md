---
name: orient
description: "Use when arriving at a project or asking where things stand and what to do next."
argument-hint: "an issue subtree, or nothing for the project"
---

At entry, refresh semantic tracker lint for the requested scope: `bun ~/.pi/agent/skills/tracker/scripts/issues.ts lint [slug]` from the project. Reconcile triage signals before selecting work; lint errors mean unavailable evidence, not a clean tracker. This is advisory, not a dispatch gate. Run once per orientation/campaign, not before each child dispatch.

Take the project views in exec and read over them yourself:

```ts
state.views = views.snapshot();
show.raw(views.format(state.views));
```

The views are computed and current as of their timestamp; narrate over them instead of recomputing or restating them. Read what they cannot tell: issue bodies and stories for the top items, what landed in git since the tracker last moved, live sessions or worktrees behind claims. Stay within the project and explicitly relevant sources; packaged skills are conventions, not project evidence. Reading is read-only: no claims, edits or launches.

Where are things at, and what is worth doing next? Orient within the requested subtree, or the current project tracker when no scope is given. Identify ongoing scopes and their live supervisors where observable, what has landed and been verified, what remains, ready work without an owner, and questions needing the user ranked by priority and transitive unblocks. Distinguish recorded state, observed contradictions, and unknowns; claims alone do not prove a session is alive. Missing, unreadable, blocked and completed trackers are different states.

Return an overview and a recommended next entry: resume or start a supervisor, or advance a scope toward tickets. Group agent-ready work by the code area it touches so disjoint streams are visible. Carry the views' hygiene findings (check, stale claims, outline drift) as dispositions. End with the facts the briefing rests on, with source references. Ready implementation belongs to a supervisor, even for a single ticket; direct implementation in this session is an explicit user choice. Preserve the conversation's purpose: a discussion of workflow problems is not authorization to execute a nearby ticket.

End the turn with the briefing; it is a natural point to compact and switch model. Before acting on it later, `show.raw(views.diff(state.views, views.snapshot()))` shows what changed since.
