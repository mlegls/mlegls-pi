---
name: supervise
description: "Use to carry an agent-ready issue subtree through execution, integration and verification, recursively."
argument-hint: "an issue whose subtree is agent-ready"
---

At entry, refresh semantic tracker lint for the scope: `bun ~/.pi/agent/skills/tracker/scripts/issues.ts lint <slug>` from the project. Reconcile its signals before starting; lint errors mean unavailable evidence, not a clean tracker.

Supervising an issue commits to finishing its whole subtree. Shaping has already refined every child to ticket or moved it out; a child that cannot be finished is an exception to recover from, not scope to trim. Discoveries start a separate idea tree (`tracker`), never a child of this issue.

Before starting the loop, the top-level supervisor chooses review boundaries: the smallest subtrees that deliver coherent changes, not a fixed tree depth or every leaf. Move review earlier when dependent work will build on a consequential contract or changes touch authorization, persistence, concurrency or shared state. Record each boundary's scope, starting ref, review owner and release point in the owning issue. Delegate to the supervisor with the relevant integration context; copy or link the assignment into its issue before dispatch, and convey changes to already-running supervisors. Descendants honor that plan and propose adjustments rather than independently adding reviews at every level.

A boundary's owner dispatches one fresh `reviewer` over the combined delta after local integration and before reporting `done` upward; at the root, before final acceptance/publication. Supply pinned base/head, contracts, existing evidence and repair authority. Let the reviewer repair directly on an isolated branch; the owner integrates those repairs serially and ensures changed behavior has current evidence, including visual judgment when required. Parent reviews cover new integration deltas and cross-subtree risks, not already-reviewed code again. Record the reviewed and repaired refs and residuals in the boundary issue. This is supervisor-managed, not an automatic leaf gate: if a boundary must stop a leaf before integration or a dependent ticket before dispatch, arrange a supervisor-owned scope there before starting the loop.

The loop is a script: `ab supervise start <slug> --budget N [--test CMD]` from your checkout (`ab supervise --help`). It dispatches ready children under you (non-leaves get `supervise` and a share of the budget), takes each leaf implement → fresh encounter → visual review for rendered journeys → integrate, closes tickets and links committed evidence packets. It messages you only on exceptions and when the subtree is done. End your turn after starting it, and after handling each message, with a line that is not a status; your parent's loop reads only `done`, `blocked` or `needs-input`.

On an exception message:
- steer: if the fix is obvious, send it to the child (`children.send`); its next turn end returns to the loop.
- answer: from the ticket, its parent's recorded decisions and your delegated authority. Record a new decision in the issue.
- consult: when judgment is beyond you, ask a frontier model once (astra or fable, low effort) with the question and the evidence in the message, then answer the child.
- change loop state: `ab supervise resume <slug> <child> verify|integrate|drop|redispatch`.
  `integrate` retries accepted work; it cannot waive missing verification. Prefer the current reviewer fixing and re-driving a gap while its context is warm. Use `verify` for a fresh collector when that is actually cheaper or necessary. See `~/dev/mlegls-pi/docs/verification-evidence.md`. Do not close unmet requirements merely because the report acknowledges them.
- escalate: a question that needs redesign moves that child out of the tree (`tracker`) and goes up with a recommendation: end your turn with `needs-input`, or `blocked` when nothing else can proceed. The rest continues.

Don't duplicate delegated review or narrate progress; own the recorded boundaries and resolve exceptions. Read code or repair a local gap when that is cheaper than another handoff. `ab supervise status` answers "where are we".

On the done message: the script has finished its children, not your review obligations. Complete the assigned boundary reviews and integrate their repairs before ending `done`. If the children's stories cross, dispatch one fresh `verify-story` worker over the crossing journeys (`route.prepare` with `stance: "verify"`, then `dispatch.dispatch`) and dispose of its findings; run this on the repaired state when review changes those journeys. Dispose of the residuals the message lists too: the caveats children reported (the loop integrated them anyway), unowned observations (file each as an idea or link its owner), and logs (move their records to attachments). Work a child closed on but left to a human judgment (a comparison "the maintainer judges", an acceptance only the user can give) must not stay hidden in an agent-assigned parent: file it as a `assignee: human` ticket blocking whatever waits on it. Then end your turn `done` with what landed, review refs and what didn't; your parent integrates your branch. If you cannot finish, end `blocked` with the exact claim and what resumes it.

At the root you answer the user instead of a parent: keep open human questions as holes in the root issue, ask each once, and report status from `ab supervise status` when asked rather than narrating events.

Only the parent integrates a child's branch; a child supervisor integrates its descendants into its own branch, never directly into the canonical checkout. Cleanup follows recorded integration, not apparent inactivity. Preserve unmerged work during recovery.
The loop owns the integration rebase as well as the merge. Do not race it with manual integration or tell both parent and child to rebase onto main. On conflict, ask the child to repair its branch against the parent's specified revision, then retry through the owning loop. Canonical publication belongs to the root supervisor when authorized; a descendant's `done` reports branch commits, not a push to main.
