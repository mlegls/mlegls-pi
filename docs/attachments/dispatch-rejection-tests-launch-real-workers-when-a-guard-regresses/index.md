# Dispatch rejection first-use drive

## Setup

- Tested revision: `d0f50d7b33c2e814b4b70c1c763adbfa4c91d64d`.
- Deployment: local Bun test CLI; no server, auth, seed or persistent deployment required.
- Owned checkout: `/Users/mlegls/dev/mlegls-pi__worktrees/dispatch-rejection-tests-launch-real-workers-when-a-guard-regresses-drive`, branch of the same name. This is the driver's checkout of the supplied revision, not the implementer's checkout.
- Entry point: `PI_AGENTS_DIR="$PWD/agents" bun-axi test lib/route-assignment.test.ts`.
- Readiness before first use: Bun and bun-axi resolve on PATH; root `node_modules` and checkout `agents/` exist. The explicit roster selector points into this checkout.
- Surface: test CLI only; no rendered journey, screenshots or browser.
- Read ticket, README and `docs/dispatch.md`; did not read source, tests, fixtures or diffs. Required initial board read exposed the implementer's claim that it stubbed launch and passed nine tests. That claim is not independent evidence.

## Predictions, recorded before first use

Story: a rejection test cannot launch a real worker when its guard stops rejecting; the regression must fail the test and leave nothing to clean up.

1. The supplied command should finish with the tracker-eligibility rejection case passing in the ordinary state, without creating a `probe` worktree. Prediction pending.
2. A controlled guard-regression run should fail the rejection case without starting a worker, worktree or tmux window. Prediction pending: the setup gives only the ordinary test command, not a regression-control entry point. The public dispatch docs describe real launches and do not offer a dry-run/regression switch. I will not invent a source mutation or an implementation-level test in this driver role.

## Session log

1. At `2026-09-30T14:20:50Z`, the historical incident path `/Users/mlegls/dev/mlegls-pi__worktrees/probe` was absent. Ran the exact supplied command. It reported `tests: all 9 passed (23ms) across 1 file` and returned successfully.
2. Replayed through plain Bun to retain the test runner's per-case output: [ordinary CLI transcript](ordinary-cli.txt). It reported the `tracker launches require eligibility and preserve the selected stance/model` case passing; total 9 pass, 0 fail, 77 expectations, 20 ms.
3. At `2026-09-30T14:21:11Z`, the historical `probe` path was still absent. No server, browser, container, tunnel or worker was deliberately started by the driver. No persistent test-created resource was observed. The path check is not continuous launch monitoring and does not establish the counterfactual safety claim.

## Outcomes and expectations

- **Ordinary CLI prediction: met.** Both runs passed, including the named rejection case; the historical probe path remained absent at the boundary checks.
- **Guard-regression prediction: unobservable.** There was no supplied user-facing way to induce the guard regression. Passing the ordinary command does not demonstrate that bypassing a guard fails safely, or that a launch stub is actually reached rather than a real launch. No guard was bypassed in this drive.
- **Contract story: unobservable.** The CLI surface was reachable and usable, but the required regression state was not driven. The reviewer must establish the missing counterfactual rather than treating the nine green tests as acceptance evidence for it.

## Frictions

- The entry point exercises the ordinary rejection path, not the changed failure mode. A consumer of the handoff can confirm a green suite but cannot reproduce the ticket's central safety claim without additional regression-control setup or reading implementation details.
- The successful bun-axi output summarizes counts without naming the relevant case; plain Bun replay provided that detail.

## Replayable checks

1. **Ordinary state:** in a checkout of the tested revision, run `PI_AGENTS_DIR="$PWD/agents" bun-axi test lib/route-assignment.test.ts`, then the same command with `bun test`. Accept exit zero, nine passed cases, and the named tracker-eligibility case passing. The recorded drive meets this check.
2. **Known incident resource:** check `/Users/mlegls/dev/mlegls-pi__worktrees/probe` before and after those commands. Accept absent before and after. The recorded drive meets this limited boundary check; it does not rule out transient or differently named launches.
3. **Required counterfactual, not executed:** prepare a disposable checkout-owned regression state in which the eligibility guard accepts an assignment that this rejection case expects to reject. Run the same case through the test CLI with launch/process/worktree observations active. Accept a nonzero test result caused by rejection no longer occurring, with zero real worker launches, zero newly created worker worktrees or tmux windows, and no cleanup needed. A launch-boundary sentinel being hit is acceptable; a real launch is not. The reviewer must supply that preparation and record the actual observation.

## Limits and cleanup

No source mutations, product repairs or new tests. No external resource was started deliberately. No evidence of a test-created resource requiring cleanup was observed. No rendered UI was used (`visual: false`, `shots: []`). The counterfactual remains unmeasured; this packet does not certify the contract.
