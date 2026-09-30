# Disabled-skill test discovery: first-use drive

## Predictions (before setup or running the product)

The ticket promises that disabled skill tests are not selected by normal Bun discovery. I expect:

1. `bun test ab` selects active matching tests and does not list any file under `skills/disabled/` or fail importing `commander` from disabled watch-pr. No explicit file-path workaround is necessary.
2. `bun test ab lib/resources` likewise excludes disabled skills while retaining active matching tests.
3. `bun test` excludes disabled skills across the full suite. Other failures would be recorded separately rather than conflated with this discovery claim.

These predictions come from the ticket and README only; no implementation, tests, fixtures or diffs were read.

## Setup

- Tested revision: `bf58ed241b521bc5292943174ba4247e07a18cc2`.
- Deployment: local Bun runner, no persistent deployment.
- Owned target: `/Users/mlegls/dev/mlegls-pi__worktrees/bun-test-ab-selects-disabled-tool-tests-with-uninstalled-commander-drive`, branch `bun-test-ab-selects-disabled-tool-tests-with-uninstalled-commander-drive`. Its HEAD matches the implementer's handoff revision.
- Persona/auth: none. Seed/state: none.
- Entry point: `bun test ab`; use README's `ab check --` queue wrapper without changing the Bun arguments.
- Bun: `1.4.2`.
- README requires `bun run setup`; run to completion before driving, even though node_modules already exists.
- No browser, server, remote deployment or deployment selector is involved.

## Session log

1. Ran `bun run setup`. Exit 0; all four installs reported no changes. [Setup output](setup.log). The checkout was ready before the first story command.
2. Ran `ab check -- bun test ab`. Exit 0, 50 pass / 0 fail, 10 files, 53.53 seconds. [Complete CLI output](bun-test-ab.log). The runner listed active `ab/` tests and other substring matches, but no `skills/disabled/` test. Prediction 1 **met**.
3. Ran `ab check -- bun test ab lib/resources`. Exit 0, 57 pass / 0 fail, 11 files, 55.94 seconds. [Complete CLI output](bun-test-ab-resources.log). Active `lib/resources/` and `ab/` test files remained selected; no `skills/disabled/` test appeared. Prediction 2 **met**.
4. Ran `ab check -- bun test`. Exit 1: 352 pass, 4 skip, 6 fail, 4 errors across 83 files in 117.10 seconds (the wrapper returned after about 151 seconds). [Complete CLI output](bun-test-all.log). No selected file was under `skills/disabled/`, and no `commander` import failure appeared. Prediction 3 **met** for disabled-skill discovery; the full suite was **not green**.
5. Replayed all five failing files via `ab check -- bun test ./dsh/overlay.test.ts ./dsh/session-patch.test.ts ./dsh/board/index.test.ts ./dsh/skim/index.test.ts ./analysis/orchestration-audits/joined-answer.test.ts`. Exit 1: 0 pass, 6 fail, 4 errors; the same errors reproduced. [Failure replay](failures-rerun.log). Missing `dsh/node_modules/.bin/dsh`, `@deepseek-ai/dsh-session`, and `@deepseek-ai/dsh-tools` are already owned by [optional dsh setup/discovery](../../issues/root-bun-test-selects-unprepared-optional-dsh.md). The missing `docs/issues/orchestration-audits.md` report is filed as [prearchive verification path](../../issues/orchestration-audits-test-reads-prearchive-report-path.md). No failures were dismissed as flakes or repaired.

### Required outcomes

| Story | Outcome | Evidence |
| --- | --- | --- |
| `bun test ab` excludes disabled skills | held | [50 pass, 0 fail](bun-test-ab.log) |
| `bun test ab lib/resources` excludes disabled skills | held | [57 pass, 0 fail](bun-test-ab-resources.log) |
| `bun test` excludes disabled skills | held | [Full discovery output](bun-test-all.log); other failures described above |

[Discovery summary](discovery-summary.log) counts the emitted test-file headers: 10, 11 and 83 respectively, with zero `skills/disabled/` paths and zero “Cannot find module/package 'commander'” errors. A plain text search for `commander` is misleading because the owned worktree name itself contains that word.

## Expectations formed during use

- `ab` still means substring matching, not “only the ab directory”: **met**, consistent with the ticket. The first command also selected extension tests and the enabled tracker tests. Disabled extensions are not disabled skills and are outside this exclusion promise.
- A normal affected-suite invocation should not require installing watch-pr's optional dependencies or spelling explicit test files: **met** for both filtered commands.
- The README's root setup should make a root test command runnable without missing-package/report errors: **not met**. Disabled-skill discovery still held, but the full suite reported optional dsh dependencies and a prearchive report path missing.

## Frictions

- Bare `ab` still selects 10 files across several directories and takes about 54 seconds. The ticket explains why, but the command is still easy to misread as directory-scoped. This is not a failure of the requested disabled-skill exclusion.
- Root `bun test` remains unsuitable as a green-baseline signal in this checkout after the documented setup. The two owners and replay evidence above distinguish that friction from this ticket's claim.

## Replayable checks

From the owned checkout, run `bun run setup`, then each of `ab check -- bun test ab`, `ab check -- bun test ab lib/resources`, and `ab check -- bun test`. Capture complete output and exit status.

- For each command, accept only if the listed test-file paths contain no `skills/disabled/` path and no disabled-watch-pr `commander` import failure. Do not merely inspect the total exit status.
- Ensure discovery still lists active `ab/` test files, not an empty selection. For the combined command also expect `lib/resources/` test files.
- Preserve any full-suite failure separately with its named file and rerun outcome; it must not be mistaken for proof of disabled-skill selection.
- Replay the five named files using the exact command in step 5. Current observed failure: missing optional dsh executable/packages and missing prearchive report. A future repair should eliminate those missing-input errors and allow each intended check to execute; merely reducing discovered tests does not establish those checks passed.

## Cleanup

All CLI commands finished. No services, browsers, containers, tunnels or remote deployments started. Evidence is nonvisual; screenshots are not applicable.

## Limits

- This is not a fully blind drive: the mandatory initial peer-board read exposed the implementer's filtered-suite pass counts before predictions were written. Predictions themselves use only the ticket and README. Existing owner: [driver board read leaks conclusions](../../issues/driver-board-read-leaks-implementer-conclusions.md).
- The log establishes actual discovery for the three required commands on Bun 1.4.2, not other runners or explicit-file overrides.

## Review (2026-09-30)

Diff is `bunfig.toml` (`[test] pathIgnorePatterns = ["skills/disabled/**"]`) plus records. Independently reran on Bun 1.4.2: `bun test ab` 50 pass / 0 fail (10 files); `bun test ab lib/resources` 57 pass / 0 fail (11 files); root `bun test` 83 files, zero `skills/disabled` paths and zero `commander` resolution errors. All three stories **held**.

Root run had 7 failures, not 6: the extra is `extensions/bash/lifecycle.test.ts` (oversized-output test), which passed on 5 of 6 isolated reruns, so it is a flake unrelated to this change; filed as [bash-lifecycle-oversized-output-test-flaky-under-load](../../issues/bash-lifecycle-oversized-output-test-flaky-under-load.md). No test retained: the exclusion is a config line whose behavior is fully recorded by the discovery logs above; a discovery test would cost a full suite run. No product repairs.
