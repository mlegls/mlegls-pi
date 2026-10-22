---
stage: "goal"
assignee: "agent"
author: "session:thr_nt35tbjva9"
priority: 2
---
# Isolate interactive edits in task worktrees and integrate when finished

## Want and source

As the maintainer running parallel BB conversations, I want changes to stay attributable to their task without commit approvals, mixed commits or another thread's dirty files blocking progress. Discussion and audit should remain cheap until they edit.

2026-10-22, @thread:thr_nt35tbjva9: "how ergonomic is it to switch worktree from bb? the proper fix could be to do changes on worktrees and merge at the end". After discussing the approach: "ok, let's file and start a session on the fixes in mlegls-pi then".

Audit evidence: @thread:thr_2pr733sy63#msg=228 (commit permission/index races), @thread:thr_bx75zyez2y#msg=294 (withheld commit). These are ownership/isolation failures, not reasons to append more commit reminders.

## Agreed direction

- Before a normal interactive session's first repository source edit, create or deliberately join its task worktree; independent tasks do not share the canonical checkout. Discussion/audit sessions need no worktree before editing. Deliberate collaborators may share one task environment.
- Keep BB's displayed environment and provider working directory aligned. Use supported creation/fork/directory-switch primitives; a successful same-thread directory switch takes effect next turn. Existing uncommitted files do not magically transfer: preserve others' changes and transfer only owned changes deliberately.
- Commit coherent owned changes as work progresses. Finish by serialized integration into the recorded target, verification and retirement; the maintainer should not have to perform the mechanics.
- Reuse existing setup and integration machinery. Setup should provision only what the task needs, and browser/backend work must retain checkout-owned runtime isolation. Canonical tracker writes remain global through the tracker backend.
- Retained review artifacts/evidence must survive disposable worktree retirement.

## Intended first use

Begin a small edit from an ordinary BB conversation while another task has unrelated dirty/staged files in the source checkout. Observe isolation before editing, correct BB/cwd identity, a scoped commit, verified integration and cleanup without altering the other task's files/index. Exercise a same-thread switch or record why a supported fork is the chosen route. Confirm retained evidence remains openable after cleanup. Create or extend a maintainer story on the implementation branch with this source.

## Scope and next work

Goal: inspect interactive edit entry points, setup costs, merge ownership and cleanup; refine the enforceable workflow before implementation. This is NOT permission to revive [[projects/mlegls-pi/issues/hand-worker-worktrees-to-bb]], which is human-assigned and explicitly deferred. It concerns interactive sessions, not replacing wm's reconciler-worker lifecycle. A missing Concept BB setup hook may require a separately owned Concept follow-up; do not alter Concept's canonical checkout from this work.

Related: [[projects/mlegls-pi/issues/pick-up-ready-work-from-the-tracker]]. Other efficiency-audit proposals are outside this session.
