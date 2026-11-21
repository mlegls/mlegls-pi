# Nested join launch recovery

Run from the checkout being driven:

```sh
bun docs/attachments/reconciler-join-launch-can-start-from-enclosing-collector/replay.ts
bun docs/attachments/reconciler-join-launch-can-start-from-enclosing-collector/replay.ts --fresh
```

The replay opens the reconciler CLI on a disposable Git repository under `/tmp` with a fake BB owner and worker backend. No credentials or live BB service are used. The enclosing collector and the node collector have diverged; the node collector contains the direct and joined children's deliveries. The first command seeds an interrupted attempt without a launch plan, waits for the saved title's worktree-path collision, and moves the unowned path aside. The reconciler retries that title. `--fresh` walks the same tree with no interrupted attempt. The replay prints the worker's actual checkout head, its landing branch and the files in its commit, then shuts down and removes the fixture.

In both runs, `workerHead` should equal `integrated` and differ from `enclosing`; the tree should contain `direct.txt` and `joined.txt`; `landingBranch` should still be `collector` (the enclosing branch).

## Independent drive

[Test predictions recorded before running either command](drive.md). Tested `6b8274a9` in the drive worktree. Both commands exited 0 in about 16 seconds combined. No live deployment was needed.

| Journey | Observed worker HEAD | Enclosing HEAD | Outcome |
| --- | --- | --- | --- |
| Recovery | `4e708da3` (exactly `integrated`) | `a2ce7558` | Held |
| Fresh | `411a72cf` (exactly `integrated`) | `46e32de1` | Held |

Recovery first printed `Worktree path already exists (not owned)` for `joiner-implement-1`, then launched that same title. Fresh launched `joiner-implement-1` without the collision. Both reported `direct.txt` and `joined.txt` in the worker's commit and `collector` as the landing branch. All predictions were met. The initial error is expected in the recovery replay and was followed by a successful launch; no unresolved friction observed.

To replay, run the commands above. In recovery, match the title in the collision and launch lines. In both runs compare the full `workerHead`, `integrated` and `enclosing` hashes, then check both file names and the landing branch. The replay covers launch and the selected landing branch; it does not land a new worker delivery.

## Original incident

The original run's log shows the initial recovery walk reaching `startPhase` after a reconciler restart, failing on the occupied path, then launching under the same title. At that revision the fresh join path supplied the node collector to `startPhaseFrom`; recovery called `startPhase`, which fell back to the enclosing checkout when there was no worker or resume head. Saving phase plans later preserved explicit sources for normal retries but did not cover interrupted receipts with no plan. The cause of the original path collision is separate.
