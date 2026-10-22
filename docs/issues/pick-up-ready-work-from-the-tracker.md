---
stage: "goal"
assignee: "agent"
author: "session:thr_nt35tbjva9"
priority: 2
---
# Pick up ready work from the tracker without shaping-thread relays

## Want and source

As the maintainer, I want a general project supervisor to discover newly ready work without my reminding shaping threads to tell it. Story: [[projects/mlegls-pi/stories/steer-issues-from-bb]].

2026-10-22, @thread:thr_nt35tbjva9: "could this be automatic based on ticket status, as in a general supervisor directly picks up specs/tickets, so there's no push from shaping threads at all?" After discussing tracker-driven execution and isolated worktrees: "ok, let's file and start a session on the fixes in mlegls-pi then".

## Agreed direction

- The tracker is the handoff: shaping writes the issue, with no outbox or direct readiness message to the supervisor.
- Use the existing whole-subtree frontier (readiness, assignment, blockers, claims), not stage alone. Claim eligible roots atomically and dispatch within the project's configured scope and budget through existing reconcilers.
- Discovery is mechanical code, not periodic model turns. Prefer change-triggered discovery with recovery scanning; duplicates, restart and competing owners must not duplicate execution.
- Ready agent-assigned work within an enabled supervisor's authorized scope is execution-authorized; human-owned/review-blocked work is not. Scope activation and concurrency must be explicit; this request does not authorize consuming every project's backlog or inventing a concurrency budget.
- Exceptions and consequential decisions reach the supervisor/user; ordinary readiness does not require a relay.

## Intended first use

Enable pickup for an isolated scope, make a previously unready tree ready through a tracker write, and observe it start once without any shaping-thread mail. Blocked, human-assigned, claimed and incomplete subtrees must remain untouched. Restart discovery and repeat the notification without duplicate starts. Capture evidence and retained limitations.

## Scope and next work

Goal, not yet an executable spec: inspect current tracker/reconciler/plugin hooks, settle activation and recovery semantics, then refine into executable contracts. Update the linked story on the implementation branch. Preserve existing manual Supervise and exception-only ownership. Related: [[projects/mlegls-pi/issues/isolate-interactive-edits-in-task-worktrees]].
