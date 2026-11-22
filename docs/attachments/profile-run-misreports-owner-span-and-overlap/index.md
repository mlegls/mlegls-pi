# First use: `profile --run` with concurrent runs

Tested revision: `0464b93c`. Offline CLI in the verification worktree; no server or auth. The supplied fixture seeds temporary Pi logs for three sessions of one owner thread, including copied fork history, and two concurrent runs. The fixture cleans up its logs on exit.

## Predictions before first use

- Both runs report short, finite spans specific to their workers, rather than stretching back to the owner's earliest session or the Unix epoch.
- The report shows worker cost and overlapping owner cost separately. Adding the worker lines from the two runs counts only the workers.
- The resumed and forked owner activity inside the run counts; copied history counts once. Owner activity outside the workers' interval contributes nothing.

## Drive and replay checks

1. Run `bun lib/profile-run.fixture.ts alpha && bun lib/profile-run.fixture.ts beta` from the checkout. Both reached the CLI report. Each reported a 50s span. Alpha printed $6.00 worker-only and $17.00 overlapping owner cost on separate lines; beta printed $5.00 and $16.00. The worker lines add to $11.00, matching the three displayed worker rows ($3 + $3 + $5). The first two predictions held.
2. Repeat each command with `--json`. Compare report `start`/`end` to the earliest child start and latest child end. Alpha was 1767225610000–1767225660000 and beta 1767225630000–1767225680000, exactly their respective worker bounds with a 30s overlap. Check that `run.workerCost` matches the sum of `children[].cost`, and `run.ownerCost` matches the root cost.
3. Compare the owner model segments in the two reports. Each shows three turns: two segments appear in both reports at identical timestamps, while alpha shows an earlier segment outside beta's bounds and beta shows a later segment outside alpha's bounds. This supports the windowing prediction. Each of the shared segments appears once per report. The CLI does not identify which owner session supplied each turn or expose per-turn costs; it cannot independently establish which turn was copied or whether all seeded sessions were accounted for. For that part of acceptance, compare the fixture's known in-window unique turns and spend to the returned `turns` and `run.ownerCost` during review.

## Friction

The header ends with `including owner`. On first reading I wasn't sure whether that applied to the span as well as active time and concurrency. The JSON bounds check resolved it. The separate cost lines were clear.
