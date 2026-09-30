# First-use CLI drive — 2026-09-30

## Before first use

Tested revision: `70be7498d7ecfecc20c65497baf2de5cb1b14f65`, Bun 1.4.2.
Owned target: local checkout on branch `root-bun-test-selects-unprepared-optional-dsh-drive`, at `/Users/mlegls/dev/mlegls-pi__worktrees/root-bun-test-selects-unprepared-optional-dsh-drive`. No server, account/authentication or seed is required. The handoff names the implementer's checkout; this drive recreates setup in the driver's own checkout rather than using that target.

Initial observation: root `node_modules` exists; `dsh/node_modules` does not. No optional dependencies will be installed to make root discovery pass.

### Predictions (recorded before setup/test commands)

1. **Root discovery without optional preparation.** After `bun run setup`, `bun test` will execute the ordinary root suite without selecting `dsh/` tests or complaining about unresolved `@deepseek-ai/dsh-session` / `@deepseek-ai/dsh-tools`. Root setup will leave `dsh/node_modules` absent. The contract is exclusion, not a wholly green unrelated suite.
2. **Setup documentation explains the boundary.** As a root developer, I can follow README's `bun run setup`, then `bun test` without optional dsh work. Both root README and dsh README will make optional setup explicit and give `bun run --cwd dsh setup`, followed by `bun test --cwd dsh` for optional-package development.

Documentation observation before commands: root README Development gives exactly those commands, explains independent checkout dependencies, and says root setup does not install dsh. dsh README independently describes it as an optional, independent package, repeats that exclusion and gives both setup commands before its separate test command. Prediction 2 is met as a documentation encounter; optional package setup/build/test functionality has not been exercised.

## Session log

- `bun run setup` (through `ab check`) completed with exit 0. Full CLI receipt: [driver-setup.log](driver-setup.log).
- After root setup, `dsh/node_modules` is absent.
- `bun test` (through `ab check`) completed with exit 1: 353 pass, 3 skip, 2 fail, 1 error, 358 tests across 78 files in 109.68 seconds. Full CLI receipt: [driver-root-test.log](driver-root-test.log). Its discovered paths contain no `dsh/` entries and its output contains neither optional import name. `dsh/node_modules` remains absent after the run. Prediction 1 is **met**; the exclusion story **held**.

## Replayable checks

- In a checkout with no `dsh/node_modules`, run `bun run setup`, wait for exit 0, and check that `dsh/node_modules` is still absent. Then run `bun test` to completion and retain the discovered test-file list and diagnostic output. Accept no selected path beginning `dsh/` and no unresolved `@deepseek-ai/dsh-session` or `@deepseek-ai/dsh-tools` import. Other suite failures must be recorded separately, not hidden by optional setup.
- Read the root README's Development section and dsh README's opening setup section. Accept an explicit optional/independent boundary, root discovery exclusion, and executable separate commands `bun run --cwd dsh setup` and `bun test --cwd dsh`; neither should imply dsh preparation is required for root testing.
- Replay `bun test ./analysis/orchestration-audits/joined-answer.test.ts`; the existing failure reproduces an ENOENT for `docs/issues/orchestration-audits.md`. Its eventual fix should let the test complete without that error. Do not prepare dsh as a workaround.
- Repeat `bun test ./extensions/bash/lifecycle.test.ts` three times, preserving all receipts. Accept consistently passing results with a searchable oversized-output notice and faithful recovered output; the current pass/fail/pass sequence does not meet that expectation. This is an observation for its existing owner, not a new optional-discovery criterion.

## Scope and resources

Only public setup/test CLI commands and user documentation were used; no source, diffs, test bodies or fixtures were read. The test runner's diagnostic output is part of the CLI encounter. No browser, server, container, tunnel or remote deployment was started. Optional dsh package-local setup/tests and model/Web journeys are outside the root-discovery contract and were not driven.

Additional expectation formed from the handoff's known failure and its existing owner: root-suite failure may remain because `analysis/orchestration-audits/joined-answer.test.ts` reads an archived report's old location. To separate that from optional-package discovery, replay that publicly named test command without reading its body. Expected diagnostic: ENOENT for `docs/issues/orchestration-audits.md`, not an optional dsh import error. Owner: [orchestration-audits test reads prearchive report path](../../issues/orchestration-audits-test-reads-prearchive-report-path.md).
- Known-failure replay completed with exit 1: [driver-known-failure.log](driver-known-failure.log).

Unexpected additional failure: `extensions/bash/lifecycle.test.ts`, “focused output stays verbatim and oversized output has a searchable original”, at `:65:16`, expected the text `Grep this file` but received a long zero string instead. This matches [the existing flaky oversized-output owner](../../issues/bash-lifecycle-oversized-output-test-flaky-under-load.md). New expectation: isolated reruns can pass, as that issue reports; run the same public test file three times and preserve every outcome rather than treating a rerun as replacement for the full-suite failure.
- Isolated lifecycle replay 1 exited 0: [receipt](driver-lifecycle-1.log).
- Isolated lifecycle replay 2 exited 1: [receipt](driver-lifecycle-2.log).
- Isolated lifecycle replay 3 exited 0: [receipt](driver-lifecycle-3.log).

## Outcomes and frictions

- **Held:** root discovery excludes optional dsh despite absent optional dependencies. Root setup is ready at exit 0; discovery reaches and completes the real CLI surface. **Met:** both setup READMEs explain the separate optional setup/test boundary.
- **Met:** the old-report expectation reproduced (0 pass, 1 fail, 1 error). **Met:** lifecycle reruns can pass, but not consistently (2 pass / 0 fail, then 1 pass / 1 fail, then 2 pass / 0 fail). **Not met:** the ordinary expectation of consistent, faithful oversized-output recovery. The middle isolated failure was at `lifecycle.test.ts:67:38` (`toBe`), unlike the full run's missing notice at `:65:16` (`toContain`). Its receipt is retained for diagnosis rather than declaring it harmless.
- **Friction:** following the root development recipe still ends with exit 1. Existing owners are [the missing report](../../issues/orchestration-audits-test-reads-prearchive-report-path.md) and [the intermittent oversized-output check](../../issues/bash-lifecycle-oversized-output-test-flaky-under-load.md). No new duplicate issue or product repair was made.
- **Friction:** the suite takes about 110 seconds. The handoff's root-suite summary had only the missing-report failure; this drive additionally encountered the existing lifecycle flake. Neither failure selected optional dsh tests.
- No additional documentation friction was encountered. Optional package setup/test behavior itself remains unmeasured, not inferred from readable commands.
