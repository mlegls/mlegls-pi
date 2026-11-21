# Reconciler progress during another run’s integration

## Predictions before first use

- With a live PID holding the shared integration lock, the fresh ticket should launch its next worker before the lock is released.
- In the same lock window, the stopped implementation should relaunch from its saved branch.
- The seeded unrecorded landing should remain unrecovered while the lock is held, then recover after release.

## Drive

Tested revision: `116a1961d6d1ec8dc3f4c55babb29a93d6a91e05`.

Run `bun docs/attachments/idle-reconciler-ticks-wait-on-another-runs-integration/fixture.ts` from the checkout. The fixture uses three real reconciler CLI processes in one disposable Git repository with fake BB and no credentials. It seeds a fresh ticket, a stopped implementation with a saved branch, and merged code whose landing has not been recorded. The command exited successfully in six seconds.

| Replay check | Observed result |
| --- | --- |
| At `Lock held`, check for a fresh worker. Accept a launched implementation worker before release. | Met: `fresh-implement-1` launched. |
| At `Lock held`, check for a resumed worker. Accept a new worker whose head matches the saved branch reported by the resume message. | Met: `resuming-implement-2` launched at `deb65d0aea05a6faa1a37d09b9729ca5035f9517`, the saved head. |
| Compare recovery at `Lock held` and `Lock released`. Accept a live pending run with no recovery in the first observation, followed by a recorded landing in the second. | Met: the held observation showed a pending run PID and `recovered: null`; the released observation showed a recorded landing at head `0eb22c6b43863dc0233e27edeecde366d8fa0212`. |

Setup observation: the output had no standalone `Ready` line as described in the handoff. `Lock held` supplied the first checkpoint with the seeded state in use; no intervention was needed.
