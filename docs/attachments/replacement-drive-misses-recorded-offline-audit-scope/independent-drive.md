# Independent first-use drive

Tested revision: `2311aa9eddc0984f69177c9fc933bde260b527bb`.

## Predictions before first use

1. The authorized test-only entry will prepare local dependencies, launch disposable shell workers and pass the regression demonstrating an integrated handler docs ruling reaches the successor checkout/history, setup and launch prompt while retaining predecessor work. No credentials or inference should be needed.
2. The user-facing handler role will explicitly require acceptance/Stories edits when a ruling changes done, separating diagnostic product failures from required claims.
3. The historical divergence recheck should distinguish availability of collector decisions from successful conflict recovery. Existing evidence predicts six pending conflicts rather than a completed historical integration; I will not run inference or repair historical branches.

## Setup checked

Deployment: local library fixture; owned target: this worker checkout and disposable fixture-owned Git checkouts. Persona: developer invoking the explicitly approved regression. Auth: none. Seed: committed regression (not inspected). Entry: `mise run setup && bun install --frozen-lockfile --cwd extensions/obsidian-tracker && bun test ./lib/reconcile/refresh.test.ts`. No inherited remote target is used.

## Encounter log

Before setup, read the prior packet and handler role as user-facing documentation, not implementation or fixture source. Handler role explicitly says a ruling changing done edits acceptance and Stories, names required handoff claims and keeps failed product observations separate. Prediction 2 met.

Ran the exact entry after recording predictions. Setup completed successfully; frozen-lockfile root installation checked 395 installs across 396 packages, and the Obsidian tracker installation installed 11 packages. The test runner reached the fixture and reported: `an integrated handler ruling reaches a successor before setup and launch, keeping predecessor work` passed; 1 pass, 0 fail, 7 assertions. Process exited 0 in approximately 5 seconds. Prediction 1 met at the explicitly approved test-runner surface; fixture internals were not inspected. No paid inference or credentials were used.

For historical divergence, replayed the existing documentary evidence in [the implementation packet](index.md#historical-integration-divergence-recheck): the refresh left six conflicts, while all four collector decisions were ancestors of MERGE_HEAD and its ticket contained the measurement rescope. Prediction 3 met in retained evidence only; no independent historical merge or final-head gate was run. This supports the requested recheck, not successful recovery of Concept's historical branch.

## Outcomes and limits

- Integrated handler docs commit reaches the successor before setup/launch while preserving predecessor work: **held**, through the approved regression runner.
- Handler instructions require acceptance/Stories updates under a changed done ruling: **held**, directly observed in `agents/roles/handle.md`.
- Historical integration divergence rechecked against refresh: **held** by replay of retained implementation evidence; independent historical recovery remains **unobservable**, not an acceptance claim of this tooling ticket.

## Frictions

None in the authorized entry. The prior packet documents why its plugin dependency preparation is part of this entry; following it avoided that known setup issue.

## Replayable checks

1. From this revision, run the exact entry above. Accept exit 0 with the named handler-ruling regression passing, zero failures and seven assertions. A setup failure must be distinguished from a reached regression failure.
2. Read `agents/roles/handle.md`. Accept explicit instructions to edit acceptance and Stories for changed done, name required claims, and preserve failed product observations separately.
3. Read the linked historical recheck. Accept explicit reporting of the six unresolved conflicts, four available collector decisions, measurement rescope, and absence of a completed recovery/gate; do not interpret it as a successful historical integration.

## Cleanup

The run-to-completion process exited. No server, browser, container, tunnel or deployment was started by this driver. Fixture cleanup is part of the committed entry; no external service remains owned by this session.

## Review

Read the diff (`68bf25b..HEAD`) with this log. `refreshWorker` merges the collector HEAD into the successor checkout inside `newThread` after worktree creation and before setup/launch; `wm.spawn` replaces the launch prompt with the one rebuilt from the refreshed checkout. The conflict path leaves MERGE_HEAD in place and passes the collector's ticket explicitly. No defects found; no repairs.

Ran `bun test` over `lib/reconcile`, `lib/dispatch.test.ts`, `lib/wm*.test.ts` and `lib/thread` (the project declares no `test:affected`): 25 pass, 3 fail (`lib/thread/lifecycle.test.ts` archive-conflict cases and one `wm.test.ts` poller case), all timeouts or git-subprocess SIGTERM under the parallel load. Rerun alone, `lifecycle.test.ts` passes 8/8 on head and on the base `68bf25b`, and `wm.test.ts`/`wm.local.test.ts`/`wm-reattach.test.ts` pass 9/9: load flakes, not regressions. `refresh.test.ts` passes.
