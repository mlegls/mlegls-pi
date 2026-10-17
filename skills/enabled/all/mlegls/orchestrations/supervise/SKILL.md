---
name: supervise
description: "Use to carry an agent-ready issue subtree through execution, integration and verification, recursively."
argument-hint: "an issue whose subtree is agent-ready, or a root whose ready subtrees to dispatch"
---

At entry, refresh semantic tracker lint for the requested scope: `bun ~/.pi/agent/skills/tracker/scripts/issues.ts lint [slug]` from the project. Reconcile triage signals before selecting work; lint errors mean unavailable evidence, not a clean tracker. This is advisory, not a dispatch gate. Run once per campaign, not before each child dispatch.

Supervising an issue commits to finishing its whole subtree. Shaping has already refined every child to spec/ticket or moved it out of the tree; a child that cannot be finished is an exception to recover from, not scope to trim. Discoveries start a separate idea tree (`tracker`), never a child of this issue.

Your parent is the supervisor that dispatched you, or the user when you are the root. Keep it oriented: established outcomes, remaining work, live streams and decisions needed. At a root without a single agent-ready issue, such as the whole project, dispatch supervisors only on the ready subtrees the tracker frontier lists; everything else belongs to shaping.

Execution belongs to the reconciler (`tools.reconcile`), which you own.

1. Orient as needed: destination, dependencies, acceptance/stories, current evidence, claims and live execution. Read directly; for broad or web evidence, dispatch a `research` worker with the question and the context it needs.
2. Start a reconciler on each ready subtree. Read `tools.reconcile_status` when a mail or the user needs it. Never kill a reconciler's process; end a run with `tools.reconcile_stop`. Starting a stopped run again continues each unfinished node from its retired worker's kept branch.
3. Resolve exceptions within recorded decisions and your delegated authority with `tools.reconcile_resolve`: `answer` the waiting worker, `retry` the failed phase or `redispatch` the node with a note, or move the node out immediately through the tracker (`tracker` lifecycle: honest stage, `assignee: human`, problem and recommendation in its body, parent `blocked-by` it when its acceptance depends on it) and resolve `move-out`. A question that would take redesign is a move-out, not a wait. Your resolution applies at once, even while a handler below you holds the exception. A worker you tell directly to continue withdraws its exception when it reports again; its handler is retired. Before relaying a proposed test, load `testing`. At the root, tell the user once per problem, batched with recommendations; when an answer arrives, move the node back in and start the reconciler again.
4. Finish when every reconciler reports done. Reconcile the global result with the evidence after code reaches the owner's target. Collector-landed entries are pending in the landing ledger; no branch issue commit or worker report signals global completion. Then report to your parent, the user at the root: outcomes, moved-out nodes and what resumes them.

Attach persistent node restrictions with `tools.reconcile_constrain({issue, node, text})`; the current worker gets mail and every later phase gets them in its first prompt. A ticket whose first use is the user's own live setup should say in its body what drive and review may and may not redo there.

Between mails, end your turn: the reconciler's mail wakes you. Don't poll or narrate. Work outside the tracker still goes through `tools.dispatch` and `merge` (`multi-agent`).

The user sets the root's concurrency budget; each reconciler's `budget` counts against it.
