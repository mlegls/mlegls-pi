---
stage: "spec"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
blocked-by:
  - "[[projects/mlegls-pi/issues/move-coordination-off-the-board]]"
---
Retire the `ab thread` registry (`~/.local/state/ab-threads`, `lib/thread/registry.ts`): bb, git config and the reconciler's own state hold what it records. Worker worktrees stay ours.

Decided 2026-10-19 with the maintainer, after `replace-the-board-with-bb-mail`. The `ab thread` commands go: "cli agents can still use bb".

What each record field becomes:
- bb thread id, spawn parent, archived, worktree path and branch, session file: bb (thread, environment, `providerThreadId`).
- `worker {run, handle}`: the reconciler's and wm's own run state, which already keeps the thread id per handle; `workerThread(handle)` (6 call sites in `lib/reconcile/reconcile.ts`, `refinement.ts`) reads that instead.
- `ownership`: a worktree is ours to remove when a wm or reconciler spawn created it, as recorded in that run's state.
- Merge target: `branch.<b>.ab-parent` in git config, unchanged; merged-ness comes from git ancestry.
- `seenAt`, `interactive`, `attention`, `terminals`, `delta`: served only the deleted `ab thread ls` view; dropped.

Why worktrees stay ours (alternative filed as [[projects/mlegls-pi/issues/hand-worker-worktrees-to-bb]]): bb's `--new-environment worktree` names branches `bb/<slug>-<thr_id>`, has no pre-launch hook for the reconciler's `prepare` (`.wm/` files, pre-merging a collector), and deletes untracked state at teardown, which our retirement keeps in `__retired/`.

What bb shows today is right: the 11 live worker worktrees' environments show their branch (2 mismatches are arkhai workers that switched branch themselves). But 1,071 of 1,082 attached checkout environments point at worktrees that no longer exist, because retirement removes the folder without telling bb.
