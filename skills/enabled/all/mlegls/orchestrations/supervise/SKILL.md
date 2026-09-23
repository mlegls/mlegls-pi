---
name: supervise
description: "Use to carry an agent-ready issue subtree through execution, integration and verification, recursively."
argument-hint: "an issue whose subtree is agent-ready, or a root whose ready subtrees to dispatch"
---

At entry, refresh semantic tracker lint for the requested scope: `bun ~/.pi/agent/skills/tracker/scripts/issues.ts lint [slug]` from the project. Reconcile triage signals before selecting work; lint errors mean unavailable evidence, not a clean tracker. This is advisory, not a dispatch gate. Run once per campaign, not before each child dispatch.

Supervising an issue commits to finishing its whole subtree. Shaping has already refined every child to spec/ticket or moved it out of the tree; a child that cannot be finished is an exception to recover from, not scope to trim. Discoveries start a separate idea tree (`tracker`), never a child of this issue.

Your parent is the supervisor that dispatched you, or the user when you are the root. Keep it oriented: established outcomes, remaining work, live streams and decisions needed. At a root without a single agent-ready issue, such as the whole project, dispatch supervisors only on the ready subtrees the tracker frontier lists; everything else belongs to shaping.

Implementation workers own changes, existing regression runs and runnable setup; fresh verifiers own acceptance and encounter-grounded replay checks. Missing coverage alone is not work to commission. Keep systematic audits separately scoped.

1. Orient as needed: destination, dependencies, acceptance/stories, current evidence, claims and live execution. Read directly; for broad or web evidence, dispatch a `research` worker (`route.prepare(question, {stance: "research"})` → `dispatch.dispatch`) with the question and the context it needs. Recover the native worker handles and reports (`multi-agent`).
2. Dispatch ready children as capacity and dependencies permit. A child's stance comes from its own assignee, the same way for every node: a non-leaf defaults to `supervise`, with a share of your concurrency budget stated in its prompt; a leaf goes through `route.prepare`, where a spec leaf takes `compile` or `auto`. Keep small edits local. Dispatch with `run` set to this issue's slug and `base` set to your committed HEAD, so children start from what has already been integrated here.
3. Answer children's questions within recorded decisions and your delegated authority. A question that would take redesign does not block you: move that child out of the tree (`tracker` lifecycle), pass the problem up with a recommendation (a small fix, stated as the one or two answers it needs, or leaving it out for shaping), and continue with the rest. Intermediate supervisors pass these up without waiting; the root tells the user once per problem. When an answer arrives, re-attach and dispatch. Incorporate updated tickets and completion reports.
4. Integrate each settled child into your branch (`merge`). Route in-contract repairs to workers; changed contracts go up as questions. Once the subtree is integrated, dispatch a fresh `verify-story` worker with runnable setup over the stories it touches that the children's own verification did not cover, especially those crossing between children. Batch related changes into a coherent journey. Landed is not yet verified; dispose of findings explicitly and close against acceptance. Reconcile the tracker with the evidence.
5. Finish when the whole subtree is integrated, verified and reconciled: report `done` to your parent, which integrates your branch. If you cannot finish, report `blocked` with the exact claim and what resumes it, including moved-out children your acceptance depends on.

Your concurrency budget comes from your parent; the user sets the root's. Child supervisors' shares count against it.

Keep this session across waves with OM and compaction. Tickets/docs hold shared truth; session/OM hold working context; retained native receipts identify live workers and pending integration. At checkpoints make a replacement recoverable without requiring one. Use `route.continuation` for worker exceptions and context checkpoints. Fresh verifiers provide independent judgment; the supervisor retains continuity.

For tracker work, pass each issue’s own `assignee` (including absence) to `route.prepare`, then carry `issue` and `assignee` into dispatch. Explicit human/session ownership requires its owner.
