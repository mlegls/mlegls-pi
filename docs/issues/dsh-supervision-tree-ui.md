---
priority: 4
stage: idea
assignee: human
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
---

A foldable per-project tree of sessions in dsh's web/desktop app, the view tmux + workmux gives now: agent sessions as a supervision tree, terminal sessions optionally as non-agent nodes in the same tree, the worktree as an annotation on a node rather than something to manage ([[projects/mlegls-pi/issues/project-scoped-sessions-and-worktrees]]). Cross-project spawns appear as roots in their project with a "requested by" link.

Open: sessions together with or separate from the terminal experience. dsh pieces to build from: the subagent panel, experimental terminal sidebar, jobs, dockkit multi-pane layout, UI slots in browser-side client plugins. Rendering is a client plugin; none of the pi TUI renderers carry over.

decision, 2026-09-30: deferred; the cockpit is workmux/tmux + `ab tree` + Obsidian ([[projects/mlegls-pi/issues/home-ui]]).
