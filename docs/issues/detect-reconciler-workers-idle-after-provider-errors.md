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
