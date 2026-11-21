# First-use drive

## Predictions before running

- Plain: starting from a completed review, a kill after the merge and before integration completes should leave one merge after restart, preserve the review result, and close the issue. If killed again just after close, the run should still finish and retire the retained worker.
- Decompose: starting from a completed refinement, the same cut should leave one merge into the collector, preserve the refinement result, and launch the resulting child once from the landed head.

## Setup

Checkout `aeb68822`, Bun and Git on PATH. The runner owns a disposable local Git repository and vault tracker; it runs the real reconciler CLI with seeded fake BB workers and needs no credentials. From the checkout root:

```sh
bun docs/attachments/replay-a-daemon-restart-mid-integrate/replay.ts
```

## Observations and replay checks

Both cases reached the post-merge SIGKILL checkpoint with only the prepared receipt surviving. The runner exited successfully in 42 seconds; it owns the child and fixture cleanup. No browser or live deployment was involved.

| Case | What happened on this run | Expectation |
| --- | --- | --- |
| Plain | After restarting, the replay killed the reconciler again after tracker close, while the integrating chain and worker still existed. The next restart cleared the chain, retired the reviewer, and notified the owner of completion. The closed result was the original review; the post-merge hook ran once. | Met |
| Decompose | After restarting, the CLI announced `decomposed root into part` and one launch of `part-implement-2`. The original turn was accepted, the stubs stayed in the collector, the child started from the landed head, and the refiner retired. The post-merge hook ran once. | Met |

To replay separately, append `plain` or `decompose` to the command. For `plain`, require both kill checkpoints, the original review result, chain cleanup, reviewer retirement, owner completion and one hook invocation. For `decompose`, require the post-merge kill, the original turn accepted, collector-only stubs, one child launch from the landed head, refiner retirement and one hook invocation.

No tooling friction encountered. The output reports recovery of the seeded turn through its original result; it does not count raw BB turn-end events. This drive covers reconciler restart with fake BB. The retired supervisor and live BB host daemon are outside the replay's surface.

## Review replay

Both cases passed again at `81ad8dc6` in 25 seconds, with one post-merge invocation each. After the tracker-close kill, the plain run retired the reviewer and finished: the reconciler processes the landed integrating chain and its cleanup receipt before `visit` can skip the closed issue. Decomposition preserved the refinement report and launched `part-implement-2` from the collector head. No runtime or fixture changes were needed.
