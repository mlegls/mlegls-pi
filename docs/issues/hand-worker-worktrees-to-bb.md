---
stage: "idea"
assignee: "human"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
---
Let bb create and tear down worker worktrees (`bb thread spawn --new-environment worktree`) instead of wm.

Deferred 2026-10-19 with the maintainer while retiring the `ab thread` registry ([[projects/mlegls-pi/issues/retire-the-ab-thread-registry]]). What it would take today:
- Branches are named `bb/<title-slug>-<thr_id>` with no flag to choose; worker handles stop being branch names.
- No pre-launch hook: the reconciler's `prepare` (writing `.wm/` files, pre-merging a collector branch) would move into the worker's first turn.
- Each repo needs a committed `.bb-env-setup.sh` (15-minute limit; failure removes the worktree) plus `.worktreeinclude`; worker identity (`.wm/launch.env`, read by `bin/bb-pi`) needs a new carrier.
- Archive tears down after a 5-minute grace and deletes untracked state, which our retirement keeps in `__retired/` (workers leave notes and smoke scripts there).

Revisit when bb lets a spawn name its branch, offers a pre-launch hook, or keeps untracked state at teardown.
