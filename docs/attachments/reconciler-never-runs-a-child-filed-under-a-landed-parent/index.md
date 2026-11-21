# Late child under a landed parent

## Predictions before first use

- The owner will see the late ready child picked up without manually moving it or restarting the run. Either reopening the parent or moving the child to an active ancestor would satisfy that expectation.
- If the reconciler moves the child, the owner will be told where it went.
- Once the child lands, its blocked sibling will become runnable and the root will be able to finish.

## Encounter

Candidate: `71cdb7f1`. From the candidate checkout, run `bun docs/attachments/reconciler-never-runs-a-child-filed-under-a-landed-parent/encounter.ts`. The encounter uses a disposable Git repository and vault tracker with simulated BB worker reports. It exited successfully in 22 seconds and removed the disposable target.

| Action | Observed | Expectation |
| --- | --- | --- |
| Start with `late` filed under `parent` after `parent` landed into `root`. | `late` moved to `root`; `late-implement-1` started from the parent's landing head (`3d0f791`). The sibling still had no phase. | Met: scheduled without an owner move or restart. |
| Check the owner's notice. | `[reconcile root] reparented late from landed parent to root; it can now be scheduled in this tree` | Met: the notice names the child and both parents. |
| Submit the child's simulated worker reports and check which worker starts. | `late` landed at `1abc976`; `sibling-implement-3` launched on that base. The original parent's receipt was unchanged. | Met: the sibling unblocked. The encounter stops at sibling launch, before final root completion. |

No usage friction surfaced.

## Replay checks

1. Compare `Seeded` and `After scheduling`: expect `lateParent` to change from `parent` to `root`, the child worker's base to equal the seeded receipt head, a null sibling phase, and a notice naming both parents.
2. Compare `Seeded` and `After simulated review`: expect the parent's receipt to match, the child's receipt to name `root`, and the sibling worker's base to equal the child's receipt head.
