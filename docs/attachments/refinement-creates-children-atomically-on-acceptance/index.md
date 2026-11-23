# Atomic proposal refinement engine (review)

Change 448cbf66..HEAD (engine commits 0e771dc0..274965fc, merged with the GitHub sibling fb9fb072). Drive was skipped (no declared drivePaths/renderedPaths touched); this review is the only pass before integration.

Replay: `bun docs/attachments/refinement-creates-children-atomically-on-acceptance/replay.ts [create|stop|promote]` (disposable Git worktrees, real vault tracker, foreground reconciler process, offline BB turns; ~10 s per mode).

## Stories and what established them

| story | outcome | evidence |
| --- | --- | --- |
| A refiner's two proposed children and interface commit: before acceptance the tracker has neither child; after a SIGKILL right after the first child's create and a restart, both exist exactly once with `claimed-by: reconcile:root`; the interface commit is on the collector and no proposal file landed | held | `replay.ts create`: "SIGKILL after provider was published and before its receipt was saved" then "restart: provider and consumer accepted once; provider launched from stripped interface" |
| Stopping a `writing` refinement leaves the tracker byte-identical | held | `replay.ts stop`: `docs/issues` tree hash unchanged, attempt `removed` |
| needs-input keeps the refiner alive for `answer`; a promotion sets `decompose: false` and goes to implement with an unchanged collector | held | `replay.ts promote` |
| Merge-before-receipt SIGKILL replay still lands stubs once with the committed proposal | held | `bun docs/attachments/replay-a-daemon-restart-mid-integrate/replay.ts` |
| GitHub claimed creates accept exactly the engine's `resolveProposedChild` output | held after seam repair | `bun test lib/tracker-github.test.ts` 9 pass (failed 1 on the merge head before 428d7e5c) |
| refinement.ts substantially smaller | held | 373 → 144 lines |

Also run on the final head: `bun test lib/reconcile/refinement.test.ts lib/reconcile/scheduling.test.ts lib/tracker-github.test.ts` (12 pass), `bunx tsc --noEmit -p .` (clean).

## Review notes

- Seam: the engine's `resolveProposedChild` defaults a missing child `stage` to `ready` (a container gets `stage: null` once its children exist). The GitHub sibling's fixture proposed a stageless leaf, which `readProposal` would reject, so its create request no longer matched the receipt. 428d7e5c gives the fixture `stage: "ready"`; no assertion changed.
- ce15bc0e drops blank lines left where provisional code was cut from reconcile.ts and scheduling.ts.
- At the join, `RefinementAttempt` dropped the provisional fields and legacy phases. The pre-landing run-state scan on 2026-11-23 found only terminal attempts: Concept 118 accepted / 20 removed; mlegls-pi 7 accepted / 1 removed.

GitHub join replay: `bun docs/attachments/refinement-creates-children-atomically-on-acceptance/github.ts`. Fake `gh` loses the first `createIssue` response after creating the provider. A fresh adapter and engine read the run from disk; the resulting issues are `gh-2` (provider) and `gh-3` (consumer, blocked by `gh-2`). Two create calls total; only the interface commit reaches the collector.

## Join review, 2026-11-23

Merged collector `6c15e7aa` with `a28fe4b7` in `5554d90d`. The collector migrated a fixture for the removed provisional protocol; the merged file keeps the acceptance-recovery case. Drive was skipped.

- `bun run typecheck` passed. `bun test lib/reconcile lib/tracker-github.test.ts` passed all 77 cases in 370 s.
- Both replays above passed: on GitHub exactly two remote creates despite losing the first reply; on the vault a SIGKILL between the first create and its receipt, a byte-identical stop, and a promotion followed by implement. The replay also checks that a vault child retains priority 4 (`78ce1585`); GitHub permits only priorities 1–3.
- `7dc88b70` shares the vault's slug and issue-wikilink grammar with proposal parsing. Typecheck, the tracker CLI / refinement / GitHub tests (43 cases), and the GitHub seam replay passed after this tidy.
- Immediately before review handoff, scanning `.refinements[] | .phase` across `.git/reconcile/*.json` showed Concept: 118 accepted, 20 removed; mlegls-pi: 7 accepted, 1 removed. No nonterminal attempt needs legacy token handling.
