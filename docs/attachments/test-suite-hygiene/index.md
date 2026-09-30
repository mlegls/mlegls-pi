# Test-suite hygiene: joined acceptance

Baseline: `6ee89980f6952f7cdede28a144fdb67a5e7c4e98`, Bun 1.4.2.
Target: fresh worker checkout on branch `test-suite-hygiene`, local Bun CLI.
No authentication, seed, deployment, or server is needed. `PI_AGENTS_DIR` was
unset; the root test preload selects this checkout's roster. Optional dsh
setup was not run.

Reproduction entry point: `bun run setup && ab check -- bun test`.
[Root setup](setup.log) completed successfully using committed lockfiles.

All four child issues are `stage: done`:

- [Disabled-skill discovery](../../issues/bun-test-ab-selects-disabled-tool-tests-with-uninstalled-commander.md).
- [Optional dsh discovery](../../issues/root-bun-test-selects-unprepared-optional-dsh.md).
- [Checkout-owned roster validation](../../issues/worktree-tests-read-canonical-agent-roster.md).
- [Safe dispatch rejection](../../issues/dispatch-rejection-tests-launch-real-workers-when-a-guard-regresses.md).

Their individual evidence remains in those tickets' linked packets. This
packet runs the joined acceptance, not their counterfactual checks again.

CLI-only evidence: visual false; screenshots none.

## Residual repair

The [baseline full suite](bun-test.log) gave 354 pass, 3 skip, 1 fail and
1 error across 78 files. The only failure was ENOENT for the orchestration
report's prearchive path. The [focused baseline replay](report-baseline.log)
reproduced it. This is a false failure, not an outstanding report defect.

`analysis/orchestration-audits/joined-answer.test.ts` now reads the report at
`docs/issues/archive/orchestration-audits.md`; its three assertions are
unchanged. [Focused repair replay](report-fixed.log): 3 pass, 0 fail.
The [existing owner](../../issues/orchestration-audits-test-reads-prearchive-report-path.md)
records the resolution. No permanent acceptance tests were added.

## Known residual defect

The existing [oversized bash-output flake](../../issues/bash-lifecycle-oversized-output-test-flaky-under-load.md)
has previously failed both the searchable-output notice assertion and equality
with the recovered log. It passed in both joined runs. It remains owned by
that issue; this acceptance does not certify its absence under load.

## Joined result

On repaired revision `869c782`, [root acceptance](bun-test-final.log)
(`ab check -- bun test`) exited 0: **357 pass, 3 skip, 0 fail**, 360 tests
across 78 files. No disabled-skill or dsh test paths were selected; optional
`dsh/node_modules` remained absent. Roster/eligibility checks passed without
an environment override. The orchestration report's three consistency
assertions passed, as did both bash lifecycle checks.

The three existing skips are the local concurrent-worker check and two
vault-dependent tracker checks. No external services or browser pages were
started; the test commands finished and their temporary resources were
cleaned up by the tests. `git diff --check` passed.

## First-use drive

[Joined CLI encounter, predictions and replayable checks](driver.md).
