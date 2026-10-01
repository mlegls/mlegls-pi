---
stage: idea
assignee: human
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
---

Think in projects: spawn agent or terminal sessions within a project without caring which worktree they land in, with an organized way to clean up work and merge/prune. Tying worktrees to the supervision tree is for that.

Working model so far:
- 1 session = 1 worktree, created lazily on first write (read-only reviewers/researchers/planners share the base), merged on close. This is nested transactions (Moss 1981): a child's commit goes into its parent's scope, conflicts surface at the parent, which has the context to resolve them. Close produces a change and a report; the parent chooses merge, abandon or keep.
- Cases for several sessions on one tree turned out to be handoffs (a reviewer continuing a child's work) or environment cost (node_modules, build caches, a dev server bound to a directory). Environment cost is a cost problem: copy-on-write clones (APFS `clonefile`), shared caches.
- Supervision and integration target are separate relations that coincide within a project. Every integration point has a manager (the kernel's maintainer hierarchy; Pro Git's integration-manager and dictator-and-lieutenants workflows), mostly a deterministic merge queue (bors/Zuul) that wakes an agent only on conflicts or red builds.
- Spawning into another project goes through that project's manager, Erlang `supervisor:start_child` style: one supervisor per session, any number of monitors. The requester subscribes to the child's lifecycle topic, the child is a root in the other project's tree with a "requested by" link back. Cross-repo dependencies are Zuul's `Depends-On`.
- A parent closing before its child: same project, the scope waits or the child's work is abandoned; cross project, the child is adopted (Unix `init`) and keeps its own integration target.

jj would change the mechanics: conflicts are data (rebases always succeed; resolution becomes a task assigned later), descendants auto-rebase (the session tree and the change DAG can be the same structure; merge on close is `squash` into the parent change), change ids are stable across rewrites (durable session↔work binding), the operation log makes automatic integration undoable, and working copies are snapshotted continuously. jj doesn't help across repos. Pijul's commuting patches are the strong form of "conflicts are data".

holes:
- jj or git: non-colocated secondary jj workspaces have no `.git`, so tools and agents shelling out to `git` break there (check current jj); agents are much less fluent in jj.
- how `lib/wm.ts` (workmux worktrees + tmux panes) maps onto this, and onto dsh in-process children vs separate processes. The host side (zmx-backed threads replacing workmux + tmux) is [[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]]; dsh in-process children remain open.
- prior art to take UX from: Conductor, Crystal, Claude Squad, vibe-kanban, container-use, Sculptor, GitButler virtual branches. None ties worktree lifetime to a supervision scope as far as we know.
