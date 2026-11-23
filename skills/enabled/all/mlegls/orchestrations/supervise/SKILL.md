---
name: supervise
description: "Use to carry an agent-ready issue subtree through execution, integration and verification, recursively."
argument-hint: "an issue whose subtree is agent-ready, or a root whose ready subtrees to dispatch"
---

At entry, run `bun ~/.pi/agent/skills/tracker/scripts/issues.ts lint [slug]` from the project once per campaign (advisory; errors mean unavailable evidence). Reconcile triage signals before selecting work.

Supervising an issue commits to finishing its whole subtree. Shaping has already brought every child to ready or moved it out of the tree; a child that cannot be finished is an exception to recover from, not scope to trim. Discoveries start a separate idea tree (`tracker`), never a child of this issue.

Your parent is the supervisor that dispatched you, or the user when you are the root. Keep it oriented: established outcomes, remaining work, live streams and decisions needed (`attention`). At a root without a single agent-ready issue, such as the whole project, dispatch supervisors only on the ready subtrees the tracker frontier lists; everything else belongs to shaping.

Execution belongs to the reconciler (`reconcile`), which you own.

1. Orient as needed: destination, dependencies, acceptance/stories, current evidence, claims and live execution. Read directly; for broad or web evidence, dispatch a `research` worker with the question and the context it needs.
2. Start a reconciler on each ready subtree. Read `reconcile_status` when a mail or the user needs it. Never kill a reconciler's process; end a run with `reconcile_stop`. Starting a stopped run again continues each unfinished node from its retired worker's kept branch.
3. Resolve exceptions within recorded decisions and your delegated authority with `reconcile_resolve`: `answer` the waiting worker, `retry` the failed phase or `redispatch` the node with a note, `accept` a review whose stories can't be observed by design (it lands with them `unobservable`; an answer can't get it past the `unheld` check), or move the node out immediately: record it through the tracker (`tracker` lifecycle: honest stage, problem and recommendation in its body, parent `blocked-by` it when its acceptance depends on it), leaving its assignment for `move-out` to set to human, and resolve `move-out`. A question that would take redesign is a move-out, not a wait; so is a UX question the linked prototype doesn't answer: shaping draws it with me, not a worker through `desk/ATTENTION.md`. Before resolving with my answer, record any lasting restriction in it with `reconcile_constrain`. Leave an exception unresolved only while `reconcile_status` shows the worker you are waiting for live in that node's current phase; a node in drive or review has no implement worker, so resolve now with what the blocked worker asked for. Your resolution applies at once, even while a handler below you holds the exception. A worker you tell directly to continue withdraws its exception when it reports again; its handler is retired. Before relaying a proposed test, load `testing`. At the root, add each problem to `desk/ATTENTION.md` (`attention`); when an answer arrives, move the node back in and start the reconciler again.
4. Finish when every reconciler reports done and code has reached the owner's target (`tracker`). Report outcomes, moved-out nodes and what resumes them to your parent (the user at the root).

Pickup: when the user enables it for a scope, `pickup({scope, budget?})` makes this thread the repository's pickup owner. A watcher process, not your turns, starts a reconciler (owned by you, without a "started" mail) on each frontier root in that scope once its issue files settle; shaping threads send no readiness messages. Never enable it on scope the user hasn't named. `pickup({paused: true})` holds new starts; `pickup_stop` ends it; `pickup_status` shows why each frontier row was skipped. A run you stopped is never restarted by pickup: restart it by hand. Your session start relaunches a missing watcher, as it does your reconcilers.

Attach persistent product constraints with `reconcile_constrain({issue, node, text})`. For instructions addressed to one worker phase, add `phase` (`refine`, `implement`, `drive`, `review`): only that phase gets the mail or first-prompt constraint, including on retry. A ticket whose first use is the user's own live setup should say in its body what drive and review may and may not redo there.

Archive a child's thread the turn its work lands or comes back to you; a done child left open reads to me as stuck.

Between mails, end your turn: the reconciler's mail wakes you. Don't poll or narrate. Work outside the tracker still goes through `dispatch` and `merge` (`multi-agent`).

The user sets the root's concurrency budget; each reconciler's `budget` counts against it.
