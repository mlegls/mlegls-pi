# Drive: checkout-owned roster validation

## Before first use

Prediction recorded before running the supplied entry point, from the ticket and README only.

- Story: roster/catalog regression checks use the checkout under test, not the host roster. I expect `bun-axi test lib/route-assignment.test.ts` to finish successfully without the ticket's `PI_AGENTS_DIR="$PWD/agents"` workaround, despite the host roster symlink pointing at the canonical checkout.
- Follow-up expectation: selecting a nonexistent host roster with `PI_AGENTS_DIR` should not change those project-regression results. An accidental host lookup should become visible without editing the shared host installation.
- I expect the CLI to identify checks run and give an unambiguous pass/fail summary.

## Setup

- Tested revision: `72a0e40d3e99fdfc1cf885285e93eea3c9f5e44d`.
- Deployment: local Bun CLI, no server or browser.
- Owned target: `/Users/mlegls/dev/mlegls-pi__worktrees/worktree-tests-read-canonical-agent-roster-drive`.
- Persona/auth: local developer; no service authentication required.
- Seed/state: committed checkout; no data reset or fixture edits. `PI_AGENTS_DIR` is initially unset. `~/.pi/agent/agents` is a symlink to `/Users/mlegls/dev/mlegls-pi/agents`, outside this checkout.
- Entry point supplied by implementer: `bun-axi test lib/route-assignment.test.ts`. Bun and bun-axi are on PATH. README says workmux performs checkout dependency setup automatically; the command itself will establish readiness.
- Method: run the supplied public CLI surface and a hostile environment selection. Do not read source, tests, diffs or fixtures.

## Session log

1. Baseline: `ab check -- bun-axi test lib/route-assignment.test.ts` returned `tests: all 9 passed (41ms) across 1 file`. Setup is ready. No roster environment workaround was used.
2. Host-selector probe: set `PI_AGENTS_DIR` to the confirmed nonexistent path `$PWD/.wm/drive-missing-roster-72a0e40` and repeat the entry point. Result: 4 passed, 5 failed. Failures report missing model lists for fill/auto and an ENOENT for the nonexistent path. The CLI's failure log reports `every agent has a model list of catalogued entries` **passed**, as did three other checks. This narrows the expectation: the ticket covers roster/catalog validators, not all runtime-routing tests. The broad command still exercises host-dependent runtime behavior.
3. Next check, formed during use: isolate the named roster/catalog validator with the same nonexistent host selector; I expect it to pass. Use direct Bun for per-check CLI output. Diagnostic logs emitted source excerpts; no source/test/fixture files were opened.
4. Isolated probe: `ab check -- env PI_AGENTS_DIR="$PWD/.wm/drive-missing-roster-72a0e40" bun test lib/route-assignment.test.ts -t 'every agent has a model list of catalogued entries'` passed: 1 pass, 8 filtered out, 0 fail, **38 expect() calls**. The validator performs assertions despite the nonexistent host selection.
5. Re-drive with the ordinary environment: `ab check -- bun test lib/route-assignment.test.ts` passed all nine named checks, 76 assertions. No persistent selector was set, and no host/worktree roster data was changed.

## Story outcome

**Held:** roster/catalog validation is independent of the host roster selection. The supplied default command passes with the canonical host symlink, and the named validator still performs 38 assertions and passes with a nonexistent host selector. This is black-box CLI evidence, not an implementation inspection.

Evidence: [default entry point](01-default.log), [host-selector probe](02-host-selector.log), [isolated validator](03-isolated-validator.log), [default re-drive](04-default-redrive.log). Nonvisual CLI journey; no screenshots.

## Expectations and frictions

- **Met:** default command succeeds without the old worktree-roster workaround (9/9).
- **Met for the contracted validator, not for the whole file:** a nonexistent host selector leaves roster/catalog validation passing. Five runtime-routing checks still fail under that deliberately invalid selector. The entry-point file includes both checkout-regression and host-runtime behavior; it is not fully environment-independent.
- **Met:** the CLI supplies pass/fail counts. Successful bun-axi output lists only the aggregate; direct Bun output identifies the individual checks.
- **Met:** the follow-up isolated validator passes with 38 assertions.
- Friction: the first run spent roughly 41 seconds queued before its 41ms test execution. This is the documented shared check admission mechanism, not observed product failure.
- Friction: the handoff supplies the entire file, so a hostile host-selector probe initially looks like a regression until the per-check output separates roster validation from runtime-routing tests.

## Replayable checks

1. With `PI_AGENTS_DIR` unset and `~/.pi/agent/agents` pointing at another checkout, run `bun-axi test lib/route-assignment.test.ts` from the tested checkout. Accept nine passes and exit 0, without setting the ticket's workaround.
2. Confirm `$PWD/.wm/drive-missing-roster-72a0e40` does not exist. Run `PI_AGENTS_DIR="$PWD/.wm/drive-missing-roster-72a0e40" bun test lib/route-assignment.test.ts -t 'every agent has a model list of catalogued entries'`. Accept one pass, zero failures, and nonzero assertions (observed 38); missing host roster must not make this validator fail or silently skip its assertions.
3. For scope diagnosis, run the entire supplied entry point with the same invalid selector. Observe the validator passing while five runtime-routing checks fail with missing-model/ENOENT diagnostics. A demand that the entire file survive this selector would be a broader contract than this ticket.
4. Remove the command-local override and repeat the ordinary command; accept nine passes. No edits to shared installation or roster files are needed.

## Limits and cleanup

- No source, tests, fixtures or implementation diff were opened. Failure diagnostics themselves included source excerpts.
- No full-library run was performed in this drive; the entry point and roster isolation were the scope.
- No server, container, tunnel or browser was started. All commands have finished; no external cleanup is required.
