# Independent empty-journal drive

## Predictions before opening the product

Revision: `fea1ca7`. Persona: mlegls with existing Pi Anthropic OAuth. Surface: Pi public session/RPC, not rendered UI. Deployment must be a newly created disposable local session owned by this checkout; the inherited temp path is an implementer encounter, not permission to modify it. Seed: synthetic child-alpha issue, job and ledger. Entry: `bun docs/attachments/supervisor-hibernation-empty-journal/drive.ts`.

From the ticket and `extensions/memory/README.md`, before launching:

1. Selecting `memory.journal: false` should cause one hibernation to persist an empty summary, zero journal blocks, `operation: empty-journal`, and `trigger: hibernate`, without a checkpoint-model call or native summary.
2. A previous journal should not survive in active context, though append-only history should retain it. Originals should remain available through `ab memory recall`.
3. The next wake in the same session should reread the child issue, job and ledger and report the artifact-based state, rather than depend on a journal.
4. The latest user-message entry and every following tool/assistant entry should survive as one verbatim suffix, with a recorded starting ID and size; this is not a fresh context.
5. Default H selection and session/branch cancellation should stay intact. A single first-use encounter may not expose these; mark them unobservable unless the supplied surface supports a concrete drive.

Expected actions: run the committed launch recipe, wait for it to finish, inspect the public-session results and durable session metadata, record any confusing or missing surface, and stop anything launched. Predictions will be marked after observation. No implementation, diff, test or fixture inspection.

## Session log

- `pi auth check --provider anthropic --json --no-refresh` returned `ready`, auth type `oauth`. No credential values collected.
- Launched the committed entry point from this checkout. It allocated `/var/folders/jx/w79f2km515l0h8lvdh8n8j_w0000gn/T/supervisor-hibernation-empty-journal-hFMasi`, a new checkout-owned synthetic local project/session, rather than reusing the implementer's inherited target.
- Launch process reported three completed agent turns (`agent_end (end)`, `agent_settled`) followed by `compaction_start`. The auth and real session surface are reachable; setup/encounter remains in progress.
- No browser, server, container or tunnel started by the collector. The recipe's child process is scoped to its disposable project.
- First encounter exited 1 after about 38 seconds with `Compaction cancelled` at the prerequisite H fold. It never announced the 305-second idle wait, C compaction, or wake result.
- Retried the exact committed command once on a fresh allocated target, `.../supervisor-hibernation-empty-journal-MXv4CF`. It reached three settled turns and the same cancellation, exiting 1 after about 21 seconds.
- Inspected selected metadata from both disposable session JSONL files and their `memory-attempts.jsonl`. Both have three user/assistant pairs, zero compaction entries, and only one ordinary `compact` attempt. Both generations ended with provider `stop` (383 and 469 output tokens), not a blocked generation. No `result.json` was produced. [Selected durable observations](driver-results.json).
- Inspected the first private rejected candidate locally; a generated journal existed but was not accepted. Did not commit checkpoint text or request captures. Cause remains undiagnosed.

## Outcomes and expectations

| Story / prediction | Outcome | Expectation | Observation |
| --- | --- | --- | --- |
| Committed launch recipe reaches C and wake | failed | not met | Both fresh runs stop at prerequisite H cancellation; the supplied entry point reaches ordinary Pi agent turns and an attempted H fold instead of C. |
| C persists empty hibernate metadata without journal generation/native fallback | unobservable | not met (not reached) | No C invocation or hibernate entry in either encounter. |
| Prior journal discarded from active context; originals recallable | unobservable | not met (not reached) | No successful prior fold, no C leaf for recall. |
| Same-session artifact-based wake | unobservable | not met (not reached) | Recipe exited before wake. |
| Exact continuous suffix documented and retained | unobservable for retention | documentation met; runtime not reached | README explicitly describes latest-user-through-leaf suffix, start ID/size and non-cap target; no successful compaction to compare. |
| Default H and branch/session cancellation preserved | unobservable | not established | Ordinary H was attempted but canceled. No branch/session change was driven; this does not establish a regression. |

Expectation formed while using it: retrying a fresh target might resolve a single generated-candidate cancellation. **Not met**: the fresh retry canceled too. Authentication and initial real-provider turns did meet the setup's reachability expectation.

## Frictions

- The C recipe requires a successful stochastic H journal before it can expose C. Two ordinary H cancellations prevented the requested story; the error exposed only `Compaction cancelled`, not a reason or documented continuation path. Filed as [[projects/mlegls-pi/issues/empty-journal-drive-cancels-before-c-selector]].
- The printed temp root was useful, but after failure there was no compact result packet; selected durable metadata had to be recovered from the session files. No product repair or replacement launcher was attempted.

## Replayable checks for review

1. **Setup reaches its promised surface.** Run `bun docs/attachments/supervisor-hibernation-empty-journal/drive.ts` from a clean checkout with ready Anthropic OAuth. Accept a completed ordinary fold, subsequent C hibernate entry and same-session wake result, rather than exit 1 at prerequisite `compact`. If H safely cancels, expect a documented supported continuation; do not silently count cancellation as C.
2. **No active journal after C.** Once the supplied encounter reaches C, compare public session entries/messages before and after it: initial H must have nonempty summary/blocks; C must have empty summary/blocks, `operation: empty-journal`, `generation: none`, and durable `trigger: hibernate`; prior journal must not appear in active wake context. No new hibernate checkpoint-model attempt or native summary should appear. This encounter did not reach these observations.
3. **Artifact resumption and original recall.** Wake that same C session; observe read actions for job, ledger and issue plus a response consistent with their state. Recall a pre-fold original with explicit session file and C leaf; accept its original content rather than a journal paraphrase.
4. **Account for the surviving tail.** Compare `details.tail` start ID with the latest pre-C user entry; the active messages should preserve that entry and every later message in order, with no holes and no earlier journal. Include a suffix larger than the configured guidance target to check that the target is not a cap. Runtime unobserved here.
5. **Cancellation remains safe.** Begin a fold, then switch session or branch before completion; accept no compaction persisted on the changed branch and no substituted native summary. Separately try a session without a legal user-message boundary; accept cancellation with unchanged context. Not driven by the supplied encounter.

## Cleanup and scope

Both launch processes exited; no Pi RPC child matching either owned temp target remained in the process listing. No servers or other outside-worktree resources were started. Temp session data is preserved, not deleted. No source, diffs, tests or fixture definitions were read, and no product repair or permanent test was written. This nonvisual setup failure neither confirms nor disproves C behavior; implementer evidence above is a separate earlier encounter, not independent verification on this run.
