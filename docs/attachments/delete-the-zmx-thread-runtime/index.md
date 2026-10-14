# bb-only runtime encounter

Revision: cef2abb8e80151d71a5ddd6174276824aaf8438d. CLI-only, no rendered UI.

## Setup and predictions (before first dispatch)

Owned target: this drive-2 worktree; bb daemon shared host service, worker target will be a newly dispatched child worktree. Persona: local developer using existing bb login; no seed or credentials required. Setup completed per parent notification. `bb status` responds and identifies this thread thr_cxc9n3aw4e and parent thr_yfrbqyxd3b.

Predictions from ticket and docs:
- Dispatch a trivial fill worker at the tested revision: receipt names an owned worktree and bb shows a child thread. Worker reports completion; integration merges its committed artifact and retires its thread/worktree.
- From a plain terminal with BB variables unset, thread launch still uses bb and creates a top-level thread.
- An unreachable daemon yields one start-bb error and no worktree. Do not stop the shared daemon to provoke this.
- Non-pi command launch is rejected clearly.
- Legacy zmx registrations can be listed without migration; no legacy registration is supplied.
- Runtime selection/admission removal and typecheck/test acceptance are source/test-review claims, not observable from this user's journey.

## Encounter

Pending.
