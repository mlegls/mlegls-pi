# Independent developer encounter — 2026-10-14

Tested revision: `9ba836bed68e8d5efb975ca298d3d57dbbeef2b9`, Bun 1.4.3. Nonvisual.

## Predictions (recorded before running)

- `bun test lib/reconcile/retry.test.ts` passes the retry-count/escalation checks and finishes well under 30s, instead of about 43s.
- `bun test` passes without real retry-backoff waits and exposes other individual tests above approximately 10s.
- Production backoff is unchanged; runner evidence may expose regression checks, but implementation equivalence cannot be established by a source-blind driver.

## Setup

Offline fake-bb fixture in this worker's checkout `/Users/mlegls/dev/mlegls-pi__worktrees/retry-tests-wait-for-real-backoff-drive-2`. Parent confirmed `mise run setup` completed. Fresh temporary repositories owned/cleaned by the fixture, automatic seed, no authentication. Entry: `bun test lib/reconcile/retry.test.ts`. No deployment selectors, servers or browser. Initial working tree clean.

## Actions and outcomes

1. Ran the entry command with `time`: 1 pass, 0 fail; case 19.020s, runner 20.80s, wall 20.816s. **Timing expectation met.** Output reports setup-network started after `retry 1/2 in 0s`; nonnetwork setup exited 1 without starting. First generic failure replaced `generic-implement-1` with `generic-implement-2`, ownerMail 0; second generic failure and authentication failure each escalated with ownerMail 1. **Retry/escalation expectation met through the existing runner assertions.** I did not inspect tests or fixtures to compare assertion text.
2. Ran `time bun test`: 224 tests / 50 files, 221 pass, 2 skip, 1 fail, 1 error, 12430 expect calls; 225.09s runner / 225.143s wall. Retry case passed in 17.355s and again reported network retry in 0s. **Retry journey held; all-green suite expectation not met.** Failure: `lib/thread/lifecycle.test.ts`, `raw integrate follows ab-parent, refuses a dirty or unprepared source, lands beside unrelated destination edits, and leaves threads active`, timeout 5003ms; accompanying git command was terminated by SIGTERM.
3. Replayed `bun test lib/thread/lifecycle.test.ts` unchanged: 8 pass / 0 fail in 15.56s. Previously failing case passed in 1.619s. This establishes a flaky timeout encounter, not its cause. Added evidence to the existing [timeout owner](../../issues/host-load-times-out-existing-regressions.md).

## Other single cases above 10s (full run)

| File | Case | Seconds |
| --- | --- | ---: |
| lib/reconcile/landing.test.ts | a rebased lockfile prepares declared deps before pre-integrate | 11.225 |
| lib/reconcile/refinement.test.ts | failed refinement stops its writer before graph-safe cleanup and replays removal without rolling back the contract | 11.074 |
| lib/reconcile/refinement.test.ts | adoption saves successor ownership before claim transfer; ordinary replacement prunes only its remaining provisional children | 10.977 |
| lib/reconcile/refinement.test.ts | landed refinement stubs forbid discard or replacement before claim conversion; recovery needs no source checkout | 27.822 |
| lib/reconcile/refresh.test.ts | an integrated handler ruling reaches a successor before setup and launch, keeping predecessor work | 10.023 |
| skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts | format-equivalent dependencies preserve all queries | 18.034 |
| skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts | invalid frontmatter fails every query with a filename and no partial output | 14.242 |

No repairs or timeout changes made.

## Replayable checks and limits

- Run the targeted entry after setup; accept pass, duration well below 30s, network retry reported in 0s and the first-replacement/no-mail then escalation/mail outcomes above.
- Run `bun test`; accept the retry case passing and collect every per-case duration above 10s. Full green was not observed; replay the named lifecycle file to distinguish a reproducible failure from this timeout flake.
- Production-default equivalence and literal preservation of assertion text are **unobservable independently** through this runner encounter. The implementation packet records direct default checks; reviewer must verify these claims with the diff and public library surface. No new open follow-up is needed for the next mandatory review stage.
- No owned processes left running; no external deployment or UI created.
