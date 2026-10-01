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

- The C recipe requires a successful stochastic H journal before it can expose C. Two ordinary H cancellations prevented the requested story; the error exposed only `Compaction cancelled`, not a reason or documented continuation path. Filed as [[projects/mlegls-pi/issues/archive/empty-journal-drive-cancels-before-c-selector]].
- The printed temp root was useful, but after failure there was no compact result packet; selected durable metadata had to be recovered from the session files. No product repair or replacement launcher was attempted.

## Replayable checks for review

1. **Setup reaches its promised surface.** Run `bun docs/attachments/supervisor-hibernation-empty-journal/drive.ts` from a clean checkout with ready Anthropic OAuth. Accept a completed ordinary fold, subsequent C hibernate entry and same-session wake result, rather than exit 1 at prerequisite `compact`. If H safely cancels, expect a documented supported continuation; do not silently count cancellation as C.
2. **No active journal after C.** Once the supplied encounter reaches C, compare public session entries/messages before and after it: initial H must have nonempty summary/blocks; C must have empty summary/blocks, `operation: empty-journal`, `generation: none`, and durable `trigger: hibernate`; prior journal must not appear in active wake context. No new hibernate checkpoint-model attempt or native summary should appear. This encounter did not reach these observations.
3. **Artifact resumption and original recall.** Wake that same C session; observe read actions for job, ledger and issue plus a response consistent with their state. Recall a pre-fold original with explicit session file and C leaf; accept its original content rather than a journal paraphrase.
4. **Account for the surviving tail.** Compare `details.tail` start ID with the latest pre-C user entry; the active messages should preserve that entry and every later message in order, with no holes and no earlier journal. Include a suffix larger than the configured guidance target to check that the target is not a cap. Runtime unobserved here.
5. **Cancellation remains safe.** Begin a fold, then switch session or branch before completion; accept no compaction persisted on the changed branch and no substituted native summary. Separately try a session without a legal user-message boundary; accept cancellation with unchanged context. Not driven by the supplied encounter.

## Cleanup and scope

Both launch processes exited; no Pi RPC child matching either owned temp target remained in the process listing. No servers or other outside-worktree resources were started. Temp session data is preserved, not deleted. No source, diffs, tests or fixture definitions were read, and no product repair or permanent test was written. This nonvisual setup failure neither confirms nor disproves C behavior; implementer evidence above is a separate earlier encounter, not independent verification on this run.

## Review pass (repair and re-drive)

Diagnosis of the driver's setup failure. The failed candidates (`memory-failed-*.md` in the driver's temp targets) were well-formed journals, but the prerequisite H fold rejected them with `Memory has missing or invalid original-source pointers (no citation to a newly folded source)`. That reason went to an extension notification the recipe did not print. Two causes, both in the recipe's synthetic seed, not the C selector:

1. The model wrote grouped citations, `[@a, @b]`; `citations()` in `extensions/memory/core.ts` only recognizes one ID per brackets, `[@a]`. Filed as [[projects/mlegls-pi/issues/archive/memory-citation-grouped-brackets-rejected]].
2. The three tiny turns are far below the 256-token tail target, so the model chose the earliest tail start and folded almost nothing to cite.

Recipe repair (`drive.ts`): print extension `notify` messages; the prerequisite fold's `customInstructions` names the tail start (third user message) and asks for one-ID brackets; default model is now `claude-sonnet-4-6` (override with `EMPTY_JOURNAL_MODEL`). The Haiku runs failed on the causes above; model capability was not separately isolated. Two intermediate runs with only some of these changes failed the same way.

Re-drive of the committed recipe at the final recipe state, session `01a0f2d8-6e41-7319-9ec8-582b6f3cfba7`, `anthropic/claude-sonnet-4-6`, 445 s wall clock, exit 0:

| Story / prediction | Outcome | Observation |
| --- | --- | --- |
| Replayable setup reaches C | held | Normal H fold `5cc5bf7d` (1211-char summary, 1 block), then the real 300 s idle deadline fired automatic hibernation; `result.json` written. |
| Empty hibernation, durable metadata | held | Compaction `25744a33`: `summary: ""`, `details.blocks: []`, `operation: "empty-journal"`, `trigger: "hibernate"`, `generation: "none"`. `memory-attempts.jsonl` holds one row, the earlier `compact`: no checkpoint model call for hibernation. |
| Prior journal removed; originals recallable | held | Active context rebuilt (`buildSessionContext` + `expandMemory`) at `25744a33` is exactly two messages: the last user turn and its reply; no "Historical memory" block. `ab memory recall 9f84a7de --session FILE --leaf b14cf252` returned the original pre-fold user message. |
| Artifact-based wake | held | Wake turn ran tool calls on issue, job and ledger (three tool results) and reported child-alpha still `running` with next action wait. |
| Tail | held | `details.tail.firstKeptEntryId` = `c34105c8`, the last user entry before hibernation ("Still waiting…"); ~25 tokens vs the 256 target; kept entries are that user turn and its assistant reply, then the wake entries. |
| Default H and cancellation | held | Default H ran live as the prerequisite fold, unchanged. Abort, nothing-to-fold and no-user-tail cancellations are covered by the retained tests; session switching mid-fold is not separately drivable in one RPC encounter, and the C path makes no awaited call between capturing the leaf and returning. |

Code change from review: an empty-journal fold is cancelled ("Nothing to fold outside a continuous tail") when nothing precedes the tail and no journal exists to discard, so repeated idle hibernations cannot write no-op empty compactions. The re-drive ran on the pre-guard extension code; the guard is covered by the unit test.

Retained tests (`extensions/memory/lifecycle.test.ts`, replaying checks 2 and 4–5 above at Pi's extension boundary with a fake clock and no provider): empty hibernation with an old journal present returns an empty summary, no blocks, `trigger: hibernate`, tail starting at the latest user entry, no old journal text and no model attempt; cancellation on abort, nothing outside the tail, and no user-led tail. Checks 1 and 3 (live setup, wake reads artifacts, original recall) stay as evidence here: they need a live model and real idle time.
