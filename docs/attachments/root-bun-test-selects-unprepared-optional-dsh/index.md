# Optional dsh root discovery — implementation checks

Revision: `ba379d1`, Bun 1.4.2. Local checkout on branch
`root-bun-test-selects-unprepared-optional-dsh`; no auth, seed, or deployment.
Root dependencies were present; `bun run setup` completed successfully.
`dsh/node_modules` was absent and optional setup was not run.

Reproduce from a checkout with Bun: `bun run setup && bun test`.

- Root `ab check -- bun test`: 354 pass, 3 skip, 1 fail, 1 error,
  358 tests across 78 files. No `dsh/` test paths or DeepSeek import errors.
  The remaining failure is `analysis/orchestration-audits/joined-answer.test.ts:9`:
  ENOENT for `docs/issues/orchestration-audits.md`. Its focused rerun reproduced
  the error; owner: [prearchive report path](../../issues/orchestration-audits-test-reads-prearchive-report-path.md).
- `ab check -- bun test ab lib/resources`: 58 pass, 0 fail across 11 files;
  the disabled-skill exclusion remains effective.
- `ab check -- bun test lib/route-assignment.test.ts`: 9 pass, 0 fail;
  the root test preload remains effective.
- `git diff --check`: passed.

The package is optional and independent, so root discovery excludes it rather
than installing it for every worker. Both setup READMEs document that boundary
and the existing opt-in setup plus `bun test --cwd dsh` entry point. Package-local
setup/tests were not exercised here; no optional tests were deleted.
No persistent resources were started.

## First-use drive

[Driver predictions, session log, expectations, frictions and replayable checks](driver.md). CLI receipts: [root setup](driver-setup.log), [root discovery](driver-root-test.log). No rendered UI was involved.

Driver outcome: root exclusion and setup-doc boundary held with `dsh/node_modules` absent before and after root setup/discovery. The driver run gave 353 pass, 3 skip, 2 fail and 1 error across 78 files. The old-report failure reproduced in isolation; the existing lifecycle flake gave pass/fail/pass. See [driver.md](driver.md) for expectations, frictions, all replay commands and receipts.
