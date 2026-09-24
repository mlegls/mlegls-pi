# Anchor identity investigation — 2026-09-21

Want: use anchors already in context to edit the intended occurrence on the first try, without rereading after unrelated or harness-owned edits.

## Method

Run `bun docs/research/anchor-identity-probe.ts`. Uses isolated temporary files and the public exec read/structured-edit API. Records actual bytes and feedback; removes temporary files. This diagnostic reports outcomes, rather than asserting defects as desired behavior.

[Captured results](anchor-identity-results-2026-09-21.json). Anchor spellings vary with temporary paths. No runtime code changed.

## Observations

| Sequence | Outcome |
| --- | --- |
| unrelated-function-change | intended edit |
| delete-first-function-surviving-statement | intended edit |
| delete-first-function-old-brace | safe rejection |
| external-delete-first-duplicate-use-survivor | survivor rejected |
| external-delete-first-duplicate-use-deleted | silent wrong edit |
| own-delete-first-duplicate-use-survivor | survivor rejected |
| own-insert-duplicate-before-survivor | silent wrong edit |
| own-delete-first-blank-use-survivor | survivor rejected |
| deleted-name-reintroduced-elsewhere | silent wrong edit |

External duplicate cases specify which occurrence the writer deleted. That intent cannot be recovered from the resulting snapshots; a different diff cannot always infer the answer.

## Findings

1. **Known edits discard known correspondence.** After applying resolved splices, `applyToFile` calls `Ledger.sync` on the result. Whole-file diff redirects an original anchor to an inserted duplicate or retires a surviving occurrence. The edit engine already knows which rows it touched.
2. **Deleted names revive.** Sync frees removed names; content-derived allocation reuses them. An older row object carries only its anchor into resolution and can edit a new occurrence elsewhere.
3. **Latest output reveals reassignment, but earlier references break.** The insertion response emits the original anchor beside the inserted row and a new anchor beside the survivor. Reinterpreting every retained reference from that output is a burden; stored row objects and preplanned edits do not update themselves.
4. **Rejections still demand rereads.** Observed deletion failures supply no current anchored context. Pre-resolution errors only request a read; pure deletions leave no fresh rows for reconciliation errors to display.

## Recommended next bounded change (not implemented)

Preserve untouched occurrence identities through harness-owned splices instead of whole-file rediff. Decide separately how unchanged interior rows in replacement spans retain identity. Prevent retired names from being reassigned while old references remain usable; account for four-character capacity and session restoration rather than assuming unlimited tombstones. Convert informative own-edit probes into regression tests for the chosen contract.

Keep external matching unchanged initially: both similar-function survivor probes worked. Truly indistinguishable external edits remain a separate decision; blanket duplicate invalidation would add friction. These nine probes do not establish real-world frequency or exhaustive correctness.

## Implementation verification — 2026-09-21

Implemented operation-aware correspondence for known edits. Untouched rows are carried directly; replacement spans reconcile only their own interior. New identities are reserved before disk writes and published after success; failed writes release unpublished reservations. Retired names persist in ledger entries and are reserved even before lazy restoration or when content no longer matches. Legacy entries load but cannot reconstruct historical retirements.

[After-fix results](anchor-identity-results-after-2026-09-21.json): all three surviving-row own-edit probes now land correctly, including blank lines; the deleted/reintroduced target now rejects. Similar-function probes still pass. The two intrinsically ambiguous external duplicate outcomes are unchanged.

Seven regression tests cover duplicate/blank survivors, insertion, replacement-interior survival, deleted-name reuse both live and after serialized restoration, and reservation of unread/mismatched restored files. Focused suite: 46 pass. TypeScript and diff whitespace checks pass.

Capacity tradeoff: the finite namespace now counts all identities issued during a session. Full retirement history increases persisted entry size; accepted to prevent stale references from silently addressing new occurrences. Whole-span ambiguous correspondence and external ambiguity remain documented limitations, not solved by this change.

Runtime-only `setup-project` scc delta against `24ce57b420bfb3f0a07c3785b0b644247a4665f4` (`ledger.ts`, `edit.ts`): code 357 → 377 (+20), complexity 136 → 152 (+16). Scoped explicitly because scanning the library directory includes installed dependencies in this checkout. Growth buys scoped correspondence plus reserved-name commit/rollback and persistence.

Full-suite verification on the shared checkout: `env -u BB_THREAD_ID bun test` finished with 203 pass, 2 skip, 0 fail. The initial BB-inherited run hit seven board-host failures; the first non-BB run had one board-delivery timeout, which passed in isolation and on the final full run. Concurrent host-library work was present; no board/host code is included in this change.

## Accepted limits

Moved from `docs/frictions.md` on 2026-09-24: "Remaining: indistinguishable external duplicate changes (and ambiguity within replaced spans) still use line-diff correspondence; whole-file rejection is out of scope. Accepted cost: the 1,048,576-name session budget includes retired identities, persisted with each file; old session entries cannot recover previously retired names."
