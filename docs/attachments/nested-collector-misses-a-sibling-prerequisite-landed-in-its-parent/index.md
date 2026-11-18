# A nested collector takes a sibling prerequisite's landing

Catch-up now checks the collector's own issue alongside its descendants. A prerequisite delivered to the shared parent uses the existing locked merge and owner conflict path.

## Replay

From the source checkout:

```sh
bun docs/attachments/nested-collector-misses-a-sibling-prerequisite-landed-in-its-parent/replay.ts
```

The script runs the reconciler CLI as the supervisor `thr_owner` against an isolated temporary Git repo, vault tracker and fake bb. No credentials, models or live Concept state are used. It seeds the first walk after landing: `prerequisite` and `dependent` are sibling tickets, `dependent` is directly blocked by `prerequisite`, and the shared parent collector holds the recorded landing. `tree/dependent` was cut before it. The script prints the Git heads and the resulting walk state, then stops the reconciler and removes the repo.

**Before (`710c27f6`):** `finished: stuck`; `tree/dependent` remained at `6cda3b3e` while its parent was at `f99742de`. The owner received `dependent: blocked by prerequisite (not satisfied at this destination)`.

**After (`9939a599`):** `merged collector into tree/dependent: prerequisite landed there`, then `launched dependent-implement-1` in the same run. The parent, nested collector and worker were all at `e1d4631a`.

`bun test lib/reconcile/collector-catch-up.test.ts lib/reconcile/scheduling.test.ts`: 5 passed. The existing cases also exercised conflict escalation and retry, and retained the hold when the ledger delivery was into a sibling collector rather than the shared parent. `bun run typecheck` passed.
