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

CLI-only evidence: visual false; shots none.

- Bun version: `1.4.2`. [Root setup](driver-setup.log) exited 0; all four
  committed dependency installations completed without changes. Root setup
  does not prepare optional dsh. The already provisioned worker dependency
  directories meant this was an idempotent setup, not a cache-empty install.
- Started the supplied root check and the two documented filtered checks from
  this worktree. The filtered check overlapped the root check through `ab check`;
  no server or browser was started.
- [Root joined acceptance](driver-root.log) exited 0: **357 pass, 3 skip,
  0 fail**, 360 tests across 78 files in 112.27 seconds. No `skills/disabled/`
  or `dsh/` test headers or optional import failures appeared. The orchestration
  report checks and both bash lifecycle checks passed. `dsh/node_modules` and
  the historical `probe` worktree path remained absent afterward.
- [Empty-host-roster probe](driver-no-host-roster.log) exited 0: **9 pass,
  0 fail** in the targeted route-assignment file. The temporary HOME was removed.
  This supports missing-host insulation, not the conflicting-roster counterfactual.
- [Filtered ab check](driver-ab.log) exited 0: **51 pass, 0 fail** across
  10 files in 54.44 seconds. [Filtered ab/resources check](driver-ab-resources.log)
  exited 0: **58 pass, 0 fail** across 11 files in 58.66 seconds. Neither selected
  disabled skills or produced `commander` import errors.

## Additional prediction before the host-roster probe

A targeted route-assignment run with `PI_AGENTS_DIR` unset and `HOME` pointing
at an empty directory owned by this worktree should still pass. This checks
that a missing host roster does not require the ticket's manual override;
it does not simulate a differing valid host roster or a guard regression.

## Replayable checks and acceptance observations

- From a worker checkout with optional `dsh/node_modules` absent, run
  `bun run setup`, wait for exit, then `ab check -- bun test`. Accept no disabled
  skill or dsh test headers, no missing-package imports and no host-roster
  assignment error. Record any failing case by name and owner rather than
  treating a responding setup command as readiness.
- Run `ab check -- bun test ab` and `ab check -- bun test ab lib/resources`.
  Accept exit 0 and no `skills/disabled/` headers or `commander` resolution error.
- Create an empty temporary HOME within the worker checkout; run
  `ab check -- env -u PI_AGENTS_DIR HOME="$temporary_home" bun test lib/route-assignment.test.ts`.
  Accept all route-assignment checks passing without the historical workaround;
  remove only that temporary HOME afterward.
- For counterfactual worker safety, the reviewer needs an authorized guard
  regression control. Accept a failing rejection assertion, zero real launches
  and no worker artifacts. This drive does not modify a guard or provide evidence
  for that counterfactual.
- Confirm all four child tickets are marked done and the READMEs document dsh's
  separate preparation. These document checks passed before CLI preparation.

## Frictions and limits

- The dispatch child is marked done but its Result still describes the initial
  driver's safety claim as unobservable and says review must establish it. The
  board reports that review did establish it; the ticket alone leaves its final
  state ambiguous. No product repair was made.
- Existing [oversized-output flake](../../issues/bash-lifecycle-oversized-output-test-flaky-under-load.md)
  remains a known failure, regardless of whether this drive encounters it.
- Empty-HOME insulation is weaker than a conflicting valid host roster. Existing
  child review evidence owns that stronger check; this joined acceptance drive
  is not an audit of every child counterfactual.
- The two filtered checks took about 201 seconds wall time including queueing,
  although Bun reported about 54 and 59 seconds respectively. Root execution
  took 112 seconds. The receipts show initial queueing; no additional setup was
  required during the wait.

## Expectations formed during use

- **Met:** setup exits successfully before tests are driven; four locked installs
  finished, with no optional dsh preparation.
- **Met:** joined acceptance succeeds without roster overrides or hand-selected
  paths; root exit 0, 357 pass / 3 skip / 0 fail.
- **Met:** optional dsh remains unprepared but does not produce false failures.
- **Met:** both substring-filtered commands pass and omit disabled-skill paths.
- **Met:** missing host roster does not break the targeted CLI (9/9).
- **Met:** the four child tickets state done and READMEs describe optional setup.
- **Met, ordinary run only:** rejection cases pass and the historical `probe`
  path is absent after the run. Guard-regression safety is **unmeasured** here.
- **Not met:** reading the completed dispatch child's Result does not clearly
  establish its reviewed completion; it still asks review to establish safety.
  The mandatory board read supplies that conclusion, not the ticket's Result.

## Joined story outcomes

- **Held:** root setup followed by `ab check -- bun test` reports no false failures.
- **Held:** root discovery excludes disabled skills and optional dsh.
- **Held:** both filtered commands exclude disabled skills and finish successfully.
- **Held:** archived orchestration report no longer causes a root false failure.
- **Held (document state):** every child ticket states done.
- **Unobservable in this drive:** launch safety when a rejection guard regresses.
  No public regression control was supplied. The child review's counterfactual
  remains the separate evidence for that property, not these green CLI runs.

## Resource ownership

The driver started no dev servers, containers, tunnels, remote deployments or
browser sessions. The host `ab` daemon was inherited and left running. The
empty-HOME probe directory was removed by its command. Test-internal temporary
resources were managed by the suite; this drive did not independently audit
those cleanup paths. All driver CLI invocations have finished.
