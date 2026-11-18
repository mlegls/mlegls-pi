# A nested collector takes a sibling prerequisite's landing

Catch-up now checks the collector's own issue alongside its descendants. A prerequisite delivered to the shared parent uses the existing locked merge and owner conflict path.

## Independent drive

Prediction before opening the CLI: With the sibling's landing already in the shared parent, a single reconciler run should bring that landing into the older nested collector and launch the dependent from the updated head. I should see catch-up before launch, with no manual merge or restart.

Tested `86a7c0b5` with the replay below. The CLI started in `/tmp/rc-protocol-h3MoKt/repo` as `thr_owner`, with the nested head at `19a981fc` and the shared parent at `27c54bd8`. The walk logged `merged collector into tree/dependent: prerequisite landed there` followed by `launched dependent-implement-1 (implement, shell)`. The nested collector and launched worker both reported `27c54bd8`, and the run had no finished state when sampled. The command exited 0 and removed the sandbox.

**Expectation met:** Catch-up and launch happened in one invocation with no operator intervention. No friction encountered. This drive exercised the ancestor-head case; it did not create a divergent collector or a conflict.

**Replay check:** The initial nested head must differ from the parent head. Look for catch-up before dependent launch in the same walk, then compare the reported nested and worker heads with the initial parent head: both should match it for this seed.

## Replay

From the source checkout:

```sh
bun docs/attachments/nested-collector-misses-a-sibling-prerequisite-landed-in-its-parent/replay.ts
```

The script runs the reconciler CLI as the supervisor `thr_owner` against an isolated temporary Git repo, vault tracker and fake bb. No credentials, models or live Concept state are used. It seeds the first walk after landing: `prerequisite` and `dependent` are sibling tickets, `dependent` is directly blocked by `prerequisite`, and the shared parent collector holds the recorded landing. `tree/dependent` was cut before it. The script prints the Git heads and the resulting walk state, then stops the reconciler and removes the repo.

**Before (`710c27f6`):** `finished: stuck`; `tree/dependent` remained at `6cda3b3e` while its parent was at `f99742de`. The owner received `dependent: blocked by prerequisite (not satisfied at this destination)`.

**After (`9939a599`):** `merged collector into tree/dependent: prerequisite landed there`, then `launched dependent-implement-1` in the same run. The parent, nested collector and worker were all at `e1d4631a`.

`bun test lib/reconcile/collector-catch-up.test.ts lib/reconcile/scheduling.test.ts`: 5 passed. The existing cases also exercised conflict escalation and retry, and retained the hold when the ledger delivery was into a sibling collector rather than the shared parent. `bun run typecheck` passed.

## Review

Replayed `45059be8`: `tree/dependent` advanced from `5b1cb0a2` to the parent’s `72c9d217`, then `dependent-implement-1` launched at `72c9d217` in the same run. The existing catch-up and scheduling checks passed, including conflict escalation and retry, and the hold for a landing recorded in a sibling collector. No repair needed.
