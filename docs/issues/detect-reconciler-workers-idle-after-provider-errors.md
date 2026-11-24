---
stage: idea
author: session:b8c305ef-a0b0-41ad-9c26-1a43247c6129
---
---
stage: idea
author: session:b8c305ef-a0b0-41ad-9c26-1a43247c6129
---
A live pi process is not proof that its worker is progressing. Surface or recover an assistant turn ending with `stopReason: error` after a grace period, without treating a healthy long turn or normal idle after a report as dead.

Concept's root supervisor (`mail/2d15485e`) observed on 2026-10-01, on pre-0be483a reconcilers:
- fold-welcome drive-b ended on Codex `invalid base64 image_url` and idled for 7.5 hours. A bad screenshot remained in context, so simply mailing `continue` would repeat the error.
- export-…-implement-1 ended on WebSocket 1006 just after a checkpoint notice.

Current main's `lib/reconcile/reconcile.ts` uses thread terminal/pid liveness, not assistant stop reasons. [[projects/mlegls-pi/issues/archive/parent-waits-on-worker-that-died-without-a-report]] already implemented this signal for the deleted `lib/jobs` supervisor; reuse its design/evidence rather than inventing a new signal. Decide bounded recovery for transient errors versus relaunch or owner exception for persistent poisoned context. Both need the canonical thread → session join and grace based on the failed turn, not file mtime (board cursor writes can keep it moving).

## Error report while the same worker continues — 2026-10-06

Concept run `return-to-an-abandoned-branch-after-a-fork` reported `error: openai-codex/gpt-6.1-sol: WebSocket closed 1000` on worker topic `return-to-an-abandoned-branch-after-a-fork/read-a-retained-session-continuation-without-selecting-it-refine-6` at 19:10:14Z (board message `mux1zt0w-sgi66u`). That session, `9a793e3b-c700-4eff-b82e-d2bdb30a0780`, continued making tool calls, posted its seam decision at 19:10:55Z (`mux20p7p-apahly`), and committed its assigned refinement as Concept `fa8ea44ed50f88e4d342c685da91da7bbc76b335` at 19:12:15Z. It had sent no terminal assignment report before those operations. At 19:12:31Z, `issues.ts tree read-a-retained-session-continuation-without-selecting-it` showed the reconciler had already replaced its current refiner with `read-a-retained-session-continuation-without-selecting-it-refine-7`, while both dispatch claims remained.

Observed impact: two refiners were assigned the same tracker file while the first was still completing it. The transport closure's cause and the reconciler's exact event ordering were not investigated. Workaround: publish the first worker's committed contract on its decision topic and identify the duplicate in its final handoff, so the supervisor can retain one result rather than combine independent refinements. Recovery must distinguish a provider-error report from a worker that is still doing work; investigate a liveness recheck/grace before redispatch, not merely a longer fixed timeout.

## Replacement starts without the previous diff — 2026-10-07

Concept run `run-sessions-in-theory-declared-modes` replaced refiner `bf02b6ce-9d28-422d-89ea-d60c138ea539` after its WebSocket 1006 report (`muykgzc1-tij8ck`, 20:35:14Z). Replacement `e210854a-9956-4967-9c24-00965a8bd039` was told to continue the branch's existing work. Its fresh checkout at `56275b99` was clean: none of the previous refiner's two typed stubs or four final child tickets existed. `git worktree list` and `git branch --list '*modes*'` showed no previous checkout or branch. The launch prompt quoted the drafted parent contract, but not the child/stub files it linked. The exact retirement/relaunch ordering was not investigated.

Observed impact: the replacement had to recover the accepted `write`/`edit` payloads from the prior session's JSONL, restore the four-ticket partition, and re-read its code context before it could finish. Workaround: recover the previous calls from the `sessionFile` retained in `~/.local/state/ab-threads/<session>.json`; reapply only the intended tracker/stub writes and recheck them, not whole shell scripts. Recovery should preserve or explicitly hand off a failed worker's uncommitted diff before retiring its checkout, rather than promise branch continuity without that diff.

## Retry discards the failed worker's diff, repeatedly — 2026-10-07

Concept run `run-sessions-in-theory-declared-modes›, node `mount-only-the-current-modes-capabilities›: three `WebSocket closed 1000› exceptions (22:57Z, 23:05Z, 23:45Z), each resolved by the owner with `retry› and a note to "continue from the branch's existing work". The reconciler launched `-implement-b›, `-c›, then `-d›. At 23:46Z `git worktree list› showed only `-implement-d›; b's and c's checkouts and branches were gone, so whatever they had not committed was lost unobserved. `-d›'s checkout held 20 modified, uncommitted files (+369/−168 across Core theory chat and Skills, `convex/turn.ts›, `application_tools.ts› and scripted-provider scripts) on top of its last commit `2b861fd7›. The owner committed them, hook skipped, as Concept `20acdd85› ("WIP: … saved by supervisor after provider disconnect") on `mount-only-the-current-modes-capabilities-implement-d› before retrying, and named that commit in the retry note. Whether the next worker actually starts from it was not yet observed.

So "retry: continue from the branch's existing work" is a false promise whenever the failed worker had uncommitted changes; with flaky transports the same node can lose work several times. Candidate for the recovery decision above: before retiring a worker after a provider error, the reconciler commits its checkout's dirty state as a WIP commit (hooks skipped, clearly labelled) on its branch and launches the replacement from that branch, stating the WIP commit in the launch prompt. Committed state is the only handoff that survives checkout retirement; the JSONL-replay workaround above is the fallback when this didn't happen.

## Owner load from transient provider errors — arkhai-payments 2026-10-05..08

Eleven provider-error exceptions reached the owner across six reconciler runs (WebSocket 1000/1006/1012, socket closed, Codex "error occurred", Anthropic overloaded), on gpt-6-luna, gpt-6.1-sol and claude-sonnet-5-5. Every one was resolved with a plain `retry`, and none needed judgment. A bounded automatic retry (for example, two attempts with backoff per node before escalating) would have removed all of them from the owner's queue.

On 2026-11-18, Concept's [[projects/concept/issues/drive-a-tutor-judged-lesson-close]] worker @thread:thr_zy3vnrmqi8#msg=1354 committed its checkpoint, then BB emitted `Pi run interrupted unexpectedly; no automatic resume was attempted` (`provider/error` at seq 1357, failed turn at 1358, compaction completed at 1362). The worker was idle and the reconciler surfaced `worker ended without a status` to a handler. Detection worked; an environment retry from the clean committed head `12621b08e` is sufficient for the interruption. The BB error did not identify its cause.

The retry also interrupted on 2026-11-18. The completed assistant item actually contains a `blocked` handoff (@thread:thr_cqydpqi5rz#msg=1640), followed by the same BB provider error at seq 1643, a failed turn at 1644, and a completed compaction turn at 1648. The reconciler raised `worker ended without a status`; its handler recovered the handoff from the assistant item and used that to act on the product blockers rather than retry a completed drive. Worktree head was clean at `5c7d49e65`. The cause of the Pi interruption is still unknown. Recovery needs to distinguish an interruption before a report from one after a complete report was already emitted.

On 2026-11-24, Concept's `a-dependent-patch-takes-only-the-base-it-needs` refiner @thread:thr_giktmje8cc#msg=255 received the run owner's ready contract answer, then emitted only `⚠ Individual quota reached … Resets in 6m59s`. BB emitted an `item/completed` of type `agentMessage` and `turn/completed` with `status: completed` (seq 255–256); the status-repair prompt got the same quota response (seq 262–263). The reconciler escalated `status (after 2 repairs)` before the quota reset. The workaround was to preserve the owner's answer in the issue contracts and retry refinement after reset. This exhausts the repair budget even with the failed-turn recovery in [[projects/mlegls-pi/issues/interrupted-bb-worker-turn-consumes-handoff-repair-budget]] because BB reports a completed turn. Investigate carrying the quota and reset as a provider signal rather than asking a quota-limited worker to repair its handoff.

The same run's next refiner (@thread:thr_v34n6pecsz#msg=409) hit the Gemini five-hour quota with 35m49s left. All three quota-only turns completed (seq 396, 403 and 410), BB provider-retry had no pending row, and the two handoff repairs raised the same exception. There was no proposal or partial commit to recover.
