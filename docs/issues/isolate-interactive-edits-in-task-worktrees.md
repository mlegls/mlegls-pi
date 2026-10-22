---
stage: "done"
assignee: "agent"
author: "session:thr_nt35tbjva9"
priority: 2
---
As the maintainer running parallel BB conversations, I want changes to stay attributable to their task without commit approvals, mixed commits or another thread's dirty files blocking progress. Discussion and audit should remain cheap until they edit.

2026-10-22, @thread:thr_nt35tbjva9: "how ergonomic is it to switch worktree from bb? the proper fix could be to do changes on worktrees and merge at the end". After discussing the approach: "ok, let's file and start a session on the fixes in mlegls-pi then".

Audit evidence: @thread:thr_2pr733sy63#msg=228 (commit permission/index races), @thread:thr_bx75zyez2y#msg=294 (withheld commit). These are ownership/isolation failures, not reasons to append more commit reminders.

## Agreed direction

- Before a normal interactive session's first repository source edit, create or deliberately join its task worktree; independent tasks do not share the canonical checkout. Discussion/audit sessions need no worktree before editing. Deliberate collaborators may share one task environment.
- Keep BB's displayed environment and provider working directory aligned. Use supported creation/fork/directory-switch primitives; a successful same-thread directory switch takes effect next turn. Existing uncommitted files do not magically transfer: preserve others' changes and transfer only owned changes deliberately.
- Commit coherent owned changes as work progresses. Finish by serialized integration into the recorded target, verification and retirement; the maintainer should not have to perform the mechanics.
- Reuse existing setup and integration machinery. Setup should provision only what the task needs, and browser/backend work must retain checkout-owned runtime isolation. Canonical tracker writes remain global through the tracker backend.
- Retained review artifacts/evidence must survive disposable worktree retirement.

## Contract

Route: same-thread switch. The thread keeps its conversation; bb's own `update_environment_directory` moves its environment, effective next turn. (A `bb thread fork --new-environment worktree` would move the user to another thread and needs a per-repo `.bb-env-setup.sh` this machinery doesn't use.)

- **Guard** (pi extension `extensions/task/`, bb sessions that aren't wm workers): an `edit`/`write` whose target is a non-ignored path inside a git repository's main worktree is refused with the route below. Ignored paths (desk/, .wm/), linked worktrees, non-git paths and tracker writes through the backend CLI pass. Opt-outs: `git config pi.taskWorktrees false` for a repository, `/edit-here` (user command) for one session. Shell-made edits are not detected (retained limit).
- **Start**: `ab task start <name>` from the canonical checkout makes `<project>__worktrees/<name>` on branch `<name>` from the checkout's branch HEAD, records `branch.<name>.ab-parent` (the target) and `branch.<name>.ab-task`, sparse-excludes docs/issues/ and runs the project's `mise run setup` exactly as worker worktrees do; `--join <name>` prints an existing task's path for a deliberate collaborator. The agent then calls `update_environment_directory` and ends its turn; `start` queues one message to its own bb thread so the next turn begins in the worktree without the user. Nothing uncommitted transfers.
- **In the task**: a system-prompt line names the task, target and finish command; bb's environment merge base is set to the target. Commit coherent owned changes as you go.
- **Finish**: `ab task finish` from the task worktree refuses uncommitted changes, then integrates through the same code path as worker integration (rebase onto the target's HEAD, fast-forward the target checkout, align its index, run its post-merge hook) under a per-repository integration lock, so concurrent finishes serialize. It never touches the target checkout's other dirty or staged files beyond what git's merge itself refuses. Then the agent moves back with `update_environment_directory`; a detached reaper waits until no process runs in the worktree, moves aside ignored state setup can't regenerate (as worker retirement does), removes the worktree, deletes the merged branch and deletes the worktree's bb environment. `ab task finish --into <branch>` also integrates a bb-managed worktree thread (records its ab-parent; bb retires its worktree on archive).
- **Evidence** belongs in committed `docs/attachments/`, so it lands with the integration and survives retirement.

Out of scope: wm/reconciler worker lifecycle and [[projects/mlegls-pi/issues/hand-worker-worktrees-to-bb]] (human-assigned, deferred). Concept's canonical checkout is not changed here.

## First use

In a disposable repository, begin a small edit from an ordinary bb conversation while another task has unrelated dirty/staged files in its checkout. Observe the refusal before editing, the same-thread switch (bb environment and pi cwd agree), a scoped commit, `finish` integration and cleanup with the other task's files and index unchanged, and committed evidence openable after cleanup. Story: [[projects/mlegls-pi/stories/edit-in-a-task-worktree]].

Related: [[projects/mlegls-pi/issues/pick-up-ready-work-from-the-tracker]]. Other efficiency-audit proposals are outside this session.

## Result

Done, landed on main (a06b6628, da9922a1, d1daa0f1). `extensions/task/` refuses an interactive bb session's edit or write to a trackable path in a main worktree and tells it the route to take. Ignored paths, linked worktrees and workers are exempt. To edit in place, the user runs `/edit-here` (one session) or sets `git config pi.taskWorktrees false` (one repository). `ab task start` creates the worktree and branch with the target recorded as ab-parent. It excludes the tracker, runs the project's `mise run setup` and queues a continuation to the thread. The thread then moves itself with bb's `update_environment_directory`. While the thread is in the task, a system-prompt line and bb's merge base both name the target. `ab task finish` reuses worker integration, refactored as `integrateCheckout`, under a per-repository lock. It then starts a reaper that removes the worktree, the merged branch and the bb environment once nothing runs inside. `finish --into` also lands bb-managed worktree threads; this session landed itself that way. The implement and mlegls-pi skills now say this, and the story edit-in-a-task-worktree was added.

First use, in live bb on a disposable bb project: an ordinary edit request went through start, same-thread switch, automatic continuation, commit, finish (fast-forward) and move back. The reaper cleaned up after the thread's next turn. Another task's unstaged and staged files were unchanged throughout. A separate probe received the refusal verbatim. Concept declares `mise run setup`, so it needs no bb setup hook or follow-up.

Remaining: the guard is on by default in every git repository under bb. Edits made from the shell aren't caught. Cleanup waits for bb to move the thread's idle pi out of the worktree.

Evidence: [docs/attachments/isolate-interactive-edits-in-task-worktrees/index.md](docs/attachments/isolate-interactive-edits-in-task-worktrees/index.md)
