---
stage: done
assignee: agent
priority: 3
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

Make the repository's test commands mean what they say. Today `bun test ab` or a root `bun test` pick up disabled skills and the optional `dsh/` package, worktree tests read the canonical checkout's agent roster, and a rejection test can launch a real worker when its guard regresses. Each is a false failure or a hazard that reviewers work around by hand. Each child states its own contract.

Done when `ab check -- bun test` in a fresh worktree after `bun run setup` fails only on real defects (list any remaining known failures in the result), and every child is done.

## Result

All four children are done. Joined acceptance in a fresh worker checkout after `bun run setup`: `ab check -- bun test` exited 0, **357 pass, 3 skip, 0 fail** across 78 files. The remaining false failure, the archived orchestration report path, was repaired without changing assertions; its [owner](orchestration-audits-test-reads-prearchive-report-path.md) is done. [Joined acceptance packet](../attachments/test-suite-hygiene/index.md).

Remaining known failure: [[projects/mlegls-pi/issues/bash-lifecycle-oversized-output-test-flaky-under-load]] can intermittently lose the oversized-output notice or recover an incomplete log. It passed in both joined runs; that defect remains with its existing owner. The three existing local-worker/vault skips remain unchanged.

Independent [first-use joined drive](../attachments/test-suite-hygiene/driver.md)
on `6fb4f57` reproduced **357 pass, 3 skip, 0 fail** after root setup,
with optional dsh dependencies absent. The checkout also passed all nine
route-assignment checks with an empty temporary HOME and no roster override.
The driver did not repeat the dispatch guard-regression counterfactual.
