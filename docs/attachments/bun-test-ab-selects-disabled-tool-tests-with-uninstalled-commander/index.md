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
4. Started `ab check -- bun test` to drive full discovery. Completion pending. [CLI output](bun-test-all.log).

## Expectations formed during use

- `ab` still means substring matching, not “only the ab directory”: **met**, consistent with the ticket. The first command also selected extension tests and the enabled tracker tests. Disabled extensions are not disabled skills and are outside this exclusion promise.
- A normal affected-suite invocation should not require installing watch-pr's optional dependencies or spelling explicit test files: **met** for `bun test ab`.

## Frictions

- Bare `ab` still selects 10 files across several directories and takes about 54 seconds. The ticket explains why, but the command is still easy to misread as directory-scoped. This is not a failure of the requested disabled-skill exclusion.

## Replayable checks

From the owned checkout, run `bun run setup`, then each of `ab check -- bun test ab`, `ab check -- bun test ab lib/resources`, and `ab check -- bun test`. Capture complete output and exit status.

- For each command, accept only if the listed test-file paths contain no `skills/disabled/` path and no disabled-watch-pr `commander` import failure. Do not merely inspect the total exit status.
- Ensure discovery still lists active `ab/` test files, not an empty selection. For the combined command also expect `lib/resources/` test files.
- Preserve any full-suite failure separately with its named file and rerun outcome; it must not be mistaken for proof of disabled-skill selection.

## Cleanup

No services, browsers, containers, tunnels or remote deployments started. CLI commands must finish before handoff. Evidence is nonvisual; screenshots are not applicable.
