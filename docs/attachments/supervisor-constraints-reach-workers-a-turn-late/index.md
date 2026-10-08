# Constraint propagation: first-use verification

## Predictions before first use

As the developer running the approved shell-worker scenario, I expect `bun test lib/reconcile/constraints.test.ts` to finish successfully. The scenario should attach a constraint while implement is running, observe it in drive and review's first launch prompts, and leave an unconstrained node without constraint text. These predictions come from the ticket and setup handoff, not the implementation.

## Setup

- Tested revision: `e1584cda908cc146c1c05e770bcca0381888e5a7`.
- Deployment: local shell-worker fixture in this checkout; the handoff identifies its target as a test-owned temporary repository, cleaned by the test.
- Persona: developer running the approved scenario; no authentication.
- Seed: committed fixture creates a running implement worker.
- Entry point: `bun test lib/reconcile/constraints.test.ts`.
- Checkout ownership confirmed by `pwd`; clean working tree before recording evidence. Bun 1.4.2 is available. No live vault or inherited deployment selector is required by this entry point.

## Encounter

Ran the entry point once from the worktree. The runner finished successfully in 4.13 seconds: 1 pass, 0 failures, 7 assertions. Its named scenario was `a mid-implement constraint reaches drive and review first prompts, not an unconstrained node`. No rendered UI is involved.

## Outcomes and expectations

- Mid-implement constraint reaches drive and review first prompts: held through the approved test-runner surface; prediction met.
- Unconstrained node receives no constraint text: held through the same scenario; prediction met.
- Runner is runnable from committed setup without additional preparation: met. No setup failure or tooling friction occurred.

This is test-runner evidence, not an independent inspection of recorded prompts or reconciler state. I did not read tests, fixtures or implementation. The supplied entry point did not expose separate tool/CLI interactions, current-worker mail, status rendering, retries or continuation. Those broader contract paths are not independently observed here; the reviewer owns their assessment. No live target was touched by the driver.

## Replayable check

At the tested revision, run `bun test lib/reconcile/constraints.test.ts` from a checkout with Bun available. Accept an exit status of zero and the named mid-implement constraint scenario passing, with zero failures. A failure or missing named scenario does not meet this check.

## Cleanup

The foreground runner exited; no driver-started service, browser, or external deployment remains. Temporary target cleanup is provided by the committed fixture according to the setup handoff, not independently inspected.

## Review

Read the diff (e1584cd) against the ticket contract. `constrain` (tool, `main.ts constrain`) records under the node in the state file under a SQLite-held write lock, so the loop's `saveState` cannot erase it (it re-reads prior constraints), mails the node's current worker, and rejects empty text or inactive nodes. `launchNow` appends constraints to the launch prompt and to the prepared prompt (read after checkout preparation, so a constraint recorded during preparation still lands); every launch carrying an issue (implement, retry, redispatch, drive, review, continuation) goes through it. `reconcile_status` shows them via `summary`. The skill lines are present. Exception-handler launches carry no issue and so no node constraints; that is outside the ticket's listed phases. No defects found, no repairs. Reran `bun test lib/reconcile`: 3 pass, 0 fail. The test's fixture calls `constrainedPrompt` from its own prepare, so `launchNow`'s wiring is read, not exercised; the CLI/tool wrappers likewise.
