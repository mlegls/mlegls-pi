# Test-suite hygiene: joined acceptance

Baseline: `6ee89980f6952f7cdede28a144fdb67a5e7c4e98`, Bun 1.4.2.
Target: fresh worker checkout on branch `test-suite-hygiene`, local Bun CLI.
No authentication, seed, deployment, or server is needed. `PI_AGENTS_DIR` was
unset; the root test preload selects this checkout's roster. Optional dsh
setup was not run.

Reproduction entry point: `bun run setup && ab check -- bun test`.
[Root setup](setup.log) completed successfully using committed lockfiles.

All four child issues are `stage: done`: disabled-skill discovery, optional dsh
discovery, checkout-owned roster validation, and safe dispatch rejection.
Their individual evidence remains in their linked packets. This packet runs
the joined acceptance, not their counterfactual checks again.

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
