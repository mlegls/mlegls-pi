---
name: supervise
description: "Start an agent-ready subtree's scripted loop and resolve its exceptions."
argument-hint: "an issue whose subtree is agent-ready"
---

At entry, refresh semantic tracker lint for the scope: `bun ~/.pi/agent/skills/tracker/scripts/issues.ts lint <slug>` from the project. Reconcile its signals before starting; lint errors mean unavailable evidence, not a clean tracker.

Supervising an issue commits to finishing its whole subtree. Shaping has already refined every child to spec or ticket or moved it out; a spec leaf's implementer may realize it or commit its children, which the loop then supervises as a subtree; a child that cannot be finished is an exception to recover from, not scope to trim. Discoveries start a separate idea tree (`tracker`), never a child of this issue; two-minute fixes are made in place (`tracker` lifecycle).

The script owns scheduling, routing, drive/review, joins, integration and closure. You own exceptions, not the children's implementation or review. Do not read children's code, run their checks, add review boundaries or commission extra reviews. Work from the wake's question, ticket, recorded decisions, handoff and evidence; ask the child for missing facts instead of reconstructing its work. Do not narrate progress, poll children or relay solved exceptions upward.

Start from your checkout: `ab supervise start <slug> [--budget N] [--test CMD] [--pick role=agent]...` (`ab supervise --help`). Budget defaults to 8. A pick bypasses the stance classifier for that role, not model admission, and persists until `role=` clears it. A project declares its integration gate as a `pre-integrate` mise task; pass `--test` only to override it. The loop dispatches ready children, drives and reviews leaves, integrates accepted branches, and handles the subtree's joined stories and consolidation. It wakes you on exceptions and completion, not routine transitions.

After starting, and after resolving a wake while the loop still runs, end the turn quietly with a line without `done`, `blocked` or `needs-input`. This overrides the worker's generic sentinel rule for these waiting turns: a child supervisor's status-free end is not completion. Never report `done` just because the loop started or one child landed.

On an exception, use the cheapest sufficient response:
- **Steer** when the next action is simple: send only that action to the waiting child.
- **Answer** from the ticket, recorded parent decisions and delegated authority. Record any new authorized decision in the owning issue, then answer the child.
- **Consult** once when judgment exceeds that context: ask astra or fable at low effort with a self-contained question, relevant decisions, evidence and the choice to settle. Use a fresh one-shot session, not the supervisor's history; for example `pi --print --no-tools --no-extensions --no-skills --no-context-files --model openai-codex/gpt-6-astra --thinking low @<question-and-evidence.md>` (or `anthropic/claude-fable-5-1`). Record the resulting decision and answer the child. If the oracle cannot settle it within authority, escalate; don't start a consultation chain.
- **Escalate** only what remains unresolved, with the exact question, evidence, your recommendation and what it unlocks. End `needs-input`, or `blocked` when nothing can proceed. Keep independent work running. A question needing shaping moves out of the execution tree with its honest stage and `assignee: human`; add a blocker wherever acceptance depends on it (`tracker`). Do not trim unmet scope to declare completion.

Send a solved exception to the child and nobody else: `ab mail <address-from-wake> '<answer>'` (or `children.send`). No acknowledgement or progress report to the parent, user or board. The issue's decision is the durable record, not a message broadcast.

Change loop state only when the recovery needs it: `ab supervise resume <slug> <child> verify|integrate|drop|redispatch`. `integrate` retries accepted work, never waives missing verification; changed behavior needs updated evidence. Prefer the current worker repairing and re-driving while its context is warm; `verify` buys a fresh driver when necessary or cheaper. Preserve unmerged work and inspect the reported loop/Git state before recovery. See `~/dev/mlegls-pi/docs/verification-evidence.md`; a caveat cannot satisfy an unmet requirement.

On the subtree-done wake, resolve the reported residuals from the reports and evidence, without inspecting code or conducting another review. Link observations to their existing owners or file separate ideas; keep evidence in committed attachments rather than logs in the issue. A required human judgment becomes an explicit human-assigned question blocking what waits on it. Once the loop's acceptance and residuals are disposed of, end `done` with the branch commits and evidence. If a requirement remains unmet, end `blocked` or `needs-input`, not `done` with a caveat.

At the interactive root the procedure is the same, except unresolved questions go to the human. Keep an open-question ledger in the root issue's `holes`: question, recommendation, blocked scope and whether it has already been asked. Ask each once; record its answer under `decisions` and remove the resolved hole. Solved exceptions stay with the child. Generate status from `ab supervise status <slug>` only when asked; distinguish running work, waits and open human questions. Do not narrate events as they arrive. Completion gets one result, not a stream of updates.

Only the parent integrates a child's branch; a child supervisor integrates its descendants into its own branch, never directly into the canonical checkout. Cleanup follows recorded integration, not apparent inactivity. Preserve unmerged work during recovery.
The loop owns the integration rebase as well as the merge. Do not race it with manual integration or tell both parent and child to rebase onto main. On conflict, ask the child to repair its branch against the parent's specified revision, then retry through the owning loop. Canonical publication belongs to the root supervisor when authorized, unless the project publishes on merge itself (a `post-merge` hook; see its AGENTS.md); a descendant's `done` reports branch commits, not a push to main.
