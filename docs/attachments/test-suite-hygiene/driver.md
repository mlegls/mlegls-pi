# Joined test-suite hygiene: first-use drive

## Target and preparation

Tested revision: `6fb4f5748ba08cfe36afd773e08b1539fbb618bc`.
Owned target: `/Users/mlegls/dev/mlegls-pi__worktrees/test-suite-hygiene-drive`,
branch `test-suite-hygiene-drive`, local Bun CLI. No authentication or seed.
Entry point: `bun run setup && ab check -- bun test`.
No server, browser or remote deployment is needed. `PI_AGENTS_DIR` is unset;
`dsh/node_modules` is absent before preparation. The executable `ab` is the
host-provided CLI; commands execute in this worker's checkout.

Sources of expectations: parent and child tickets and the root README.
The mandatory board read also exposed prior workers' conclusions before this
encounter; these predictions are not blind to those claims. No implementation,
test source or fixture was read.

## Predictions recorded before product use

1. **Joined acceptance:** setup should finish without optional package preparation;
   then `ab check -- bun test` should report no setup/discovery failures. A real
   defect may still fail, but needs a named owner. I expect a green run, with the
   existing skips visible and the known oversized-output flake possibly recurring.
2. **Disabled skills:** both `ab check -- bun test ab` and
   `ab check -- bun test ab lib/resources` should finish without disabled-skill
   paths or `commander` import errors. The full root run should exclude them too.
3. **Optional dsh:** root setup should leave optional dependencies absent and root
   discovery should select no `dsh/` test paths. README should explain the separate
   optional setup; it does.
4. **Checkout roster:** the full root run should pass roster/eligibility checks
   without my setting a roster override. This ordinary run alone cannot establish
   insulation from a deliberately stale host roster.
5. **Rejection safety:** ordinary eligibility tests should finish without launching
   a historical `probe` worker. There is no public guard-regression control in the
   supplied entry point, so the counterfactual safety property is not observable
   by this joined CLI drive; the child's reviewer must own that evidence.
6. **Children complete:** the four child tickets should state done; all four do.
   This is a documented lifecycle observation, not a re-audit of implementation.

## Session log

Preparation and journeys pending. CLI-only evidence: visual false; shots none.
