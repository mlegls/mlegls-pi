---
persona: maintainer
kind: process
---

## Edit in a task worktree

I run several bb conversations on one project at once. Talking about the code, auditing it or reading it costs nothing extra. When a conversation starts changing files, its changes live in their own worktree and branch, so another conversation's dirty or staged files never end up in its commits, never block its commit, and its commits never need my approval to separate them.

- A conversation in the project checkout goes to edit a file → it is told to start a task instead → it makes the task's worktree (set up as worker worktrees are), moves itself there and carries on in the next turn without my asking. I stay in the same thread; bb shows the thread's environment as the worktree.
- In the task it commits as it goes. bb's diff compares against the checkout's branch.
- Done and verified → it finishes: its commits land on the checkout's branch, one task at a time; anything else dirty or staged in the checkout is left exactly as it was. It moves back, and the worktree and merged branch go away once nothing runs there. Evidence it committed under `docs/attachments/` is in the checkout.
- Two conversations collaborating on purpose can share one task worktree.
- I can let one conversation edit the checkout directly (`/edit-here`), or turn this off for a repository (`git config pi.taskWorktrees false`).

Source, 2026-10-22, @thread:thr_nt35tbjva9: "how ergonomic is it to switch worktree from bb? the proper fix could be to do changes on worktrees and merge at the end"; "ok, let's file and start a session on the fixes in mlegls-pi then". Audit evidence: @thread:thr_2pr733sy63#msg=228 (commit permission/index races), @thread:thr_bx75zyez2y#msg=294 (withheld commit). Issue: [[projects/mlegls-pi/issues/isolate-interactive-edits-in-task-worktrees]].

Implementation: `extensions/task/` (the refusal and the task's prompt line), `lib/task.ts` (`ab task start|join|finish`).
