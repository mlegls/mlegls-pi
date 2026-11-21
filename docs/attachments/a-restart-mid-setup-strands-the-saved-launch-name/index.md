# Restart during worker setup: first-use drive

Revision: `9405c5eb945bf0e0c9dfeccebd6365233b9d7969`. Persona: run owner `thr_owner`. The handoff uses a disposable local Git repository, the real reconciler, and fake BB. It seeds a saved launch name, linked worktree and setup log with no worker thread, representing the state left after a restart.

## Predictions before use

- **Clean leftover:** Resume the saved launch. Expect setup to reach a single worker spawn under the original name without manually deleting the worktree or branch, instead of recurring “Worktree path already exists (not owned)” errors.
- **Dirty leftover:** Resume with local changes present. Expect no spawn, local changes to be preserved, and one owner exception identifying the occupied checkout instead of repeated retries.

## Encounter and replayable checks

Run these commands from the repository root at the revision above. Each command sets up its own disposable target and exits; no server or credentials are needed.

| Story | Action and acceptance check | Observed |
| --- | --- | --- |
| Resume the saved launch after interrupted setup leaves a clean checkout | Run `bun docs/attachments/a-restart-mid-setup-strands-the-saved-launch-name/replay.ts clean`. Confirm the seed shows a clean checkout and only the owner thread. Expect a reclaim log entry followed by exactly one spawn with the same handle, without manual cleanup. | **Held.** The seed showed only `thr_owner` and no changes. The log recorded reclaim then launch for `root-implement-1`; one spawn, clean status, exit 0. |
| Hold an occupied saved name for the owner when there are local changes | Run `bun docs/attachments/a-restart-mid-setup-strands-the-saved-launch-name/replay.ts dirty`. Expect unchanged dirty status, no spawns, and one owner exception with the checkout, branch, reason and a retry instruction. | **Held in the replay.** Status was `M code.txt` before and after, with zero spawns and one exception entry marked `mailed: true`. It named the checkout and branch, identified the uncommitted changes, and said to preserve any work and retry when the name is free. Exit 0. |

Both predictions were met in the replay. No friction on the supplied CLI surface. This drive starts from the seeded restart aftermath; it does not interrupt a live setup or verify delivery through a live BB account or retry behavior beyond the replay.
