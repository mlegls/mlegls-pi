# Independent CLI encounter

Tested revision: 0a00b73cc5682dfc8ddb9fd8e970c957665fb9f6 (2026-10-08). Persona: local operator; no authentication or model. Surface: public reconcile CLI through the committed setup commands. No implementation, test or fixture source inspected.

## Predictions recorded before opening the product

1. Prepare gives a checkout-owned isolated Git target with a running reconciler, live worker and handler, unmerged commits and collector. **Met.**
2. Stop terminates the reconciler, retires worker/handler threads and owned worktrees and processes, but retains unmerged branches and collector. **Met.**
3. Status immediately reports finished/stopped and no live worker receipts, without restarting a daemon. **Met.**
4. Repeating stop is safe and retains the stopped state. **Met.**

## Setup and readiness

Ran `mise run setup`, `bun install --frozen-lockfile --cwd extensions/obsidian-tracker`, then `bun docs/attachments/stopped-supervise-jobs-have-no-cleanup-path/fixture.ts prepare`. Setup completed successfully. It created /private/tmp/rc-stop-lD3SB5, an isolated local target owned by this encounter, using this worktree's CLI. No inherited deployment reused. Prepare reported readiness; inspect independently showed running=true, reconcilerAlive=true, leftoverAlive=true, three active threads and terminals, implement/handler/launch-race worktrees, main and tree/fixture collector.

## Actions and outcomes

Ran `bun docs/attachments/stopped-supervise-jobs-have-no-cleanup-path/fixture.ts stop /private/tmp/rc-stop-lD3SB5`. It exited successfully in four seconds, reported finished=stopped, running=false, stopping=false, empty chains/exceptions, and retirement receipts. The implement receipt included the deliberately leftover PID 61615.

Immediately ran the corresponding `inspect` command. Threads and terminals were empty, reconcilerAlive and leftoverAlive were false, all three worker worktrees were gone. Main and tree/fixture remained checked out at original seed 0b15cdc. All three worker branches remained. `git -C /private/tmp/rc-stop-lD3SB5/repo log --branches --not main --oneline` showed their unmerged commits 10a9e6f (implement), 34e18d1 (handler), 8cbe9d7 (launch-race). No daemon restart occurred.

Repeated stop. It returned the same finished/stopped state and retired=[]; a new inspect preserved every observation above. Only an additional stopped log entry appeared.

Ran fixture `cleanup` on the same owned root; it exited successfully with “Fixture removed”. No encounter services or temporary deployment remain.

## Replayable checks

Use the index's prepare command; substitute its freshly printed ROOT below (do not reuse the deleted target).

- Before stop: `fixture.ts inspect ROOT` should show a live reconciler, live leftover process, three active threads/terminals, worker worktrees and collector. This confirms stop encounters actual live resources.
- Run `fixture.ts stop ROOT`, then `fixture.ts inspect ROOT` immediately. Accept finished=stopped, running=false, stopping=false, empty chains/exceptions/threads/terminals, both process liveness flags false, and only main/collector worktrees. Observed all.
- Use Git's `log --branches --not main --oneline` on ROOT/repo and compare branch commit IDs against pre-stop worktree HEADs. Accept preservation of all three unmerged commits and unchanged collector HEAD. Observed all.
- Repeat stop and inspect. Accept no new retirements, no re-created workers and retained branches/collector. Observed all.
- Always `fixture.ts cleanup ROOT` after measurements.

## Frictions and limits

No product friction encountered on the changed CLI journey. The fixture's isolated selectors make setup and replay straightforward. This is nonvisual CLI evidence; no screenshots. The model-facing tool invocation was not driven independently; the public CLI stop/status behavior was. Cleanup-failure latch behavior is outside this live happy-path encounter.

## Review (2026-10-08)

Read the diff against the ticket's reconciler-terms contract and reran `lib/reconcile/stop.test.ts` plus constraints, checkpoint and refresh tests on the final head: 4 passed. All four stories hold on the diff's logic: the stopping latch is set before observation; PID reuse is guarded by a command check; handles missing from the chain are found through the thread registry; restart after a stopped run clears `finished` in `run`; session startup skips `stopping` runs. One repair: the supervise skill told supervisors only to start and resolve, so it now names `reconcile_stop` instead of killing the process. Not driven: cleanup-failure retry path.
