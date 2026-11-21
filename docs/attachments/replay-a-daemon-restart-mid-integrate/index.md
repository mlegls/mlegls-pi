# Restart during reconciler integration

Run from the checkout root with Bun and Git on `PATH`:

```sh
bun docs/attachments/replay-a-daemon-restart-mid-integrate/replay.ts
```

Pass `plain` or `decompose` to run just one case. The replay creates its own temporary Git repository and vault tracker, seeds an owned worker worktree and completed turn in fake BB, and drives the real `lib/reconcile/main.ts run` CLI. No accounts, credentials, model calls or live BB changes. The runner stops its child and removes the fixture at exit.

Both cases ran against `fb3d7737fa47c3acb62954042393144dd391f304`. The fixture's `post-merge` hook sent `SIGKILL` after the destination fast-forward and before the reconciler could save its landed receipt. The runner checked the signal, destination HEAD, prepared receipt and surviving worker before restarting against the same state.

| Case | After restart |
| --- | --- |
| Plain reviewed landing | Recovered the landing and closed the tracker issue. The runner killed the reconciler again immediately after that close, while the integrating chain and reviewer worktree still existed. The next run cleared the chain, retired the review thread, worktree and branch, kept the original review's result, and reported `done` to the owner. |
| Refiner decomposes a spec | Recovered the stubs in the collector, retained the original refinement report, converted the child's provisional claim to the run's claim, retired the refiner, and launched exactly one child from the landed collector head. The owner's checkout had only tracker updates. |

Each destination saw exactly one `post-merge` hook invocation across all starts. Neither case raised an owner exception. No runtime repair was needed for these cuts.

This exercises the current reconciler process. `lib/jobs/supervise.ts` and its `integrate-start` / `integrate-done` events were removed in `b40cdecd`; the replay uses the equivalent Git/receipt boundary instead. The old unfinished-event check is irrelevant to this version. The replay does not establish restart behavior for the retired supervisor, the live BB host daemon, a kill during Git's write, or a project-specific post-merge hook with side effects.
