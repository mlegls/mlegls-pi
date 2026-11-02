# Tracker persistence defers across an in-progress canonical operation

Review of f7b21f64 (base 8580fd5e). Ticket is `drive: none`; the tests are the acceptance.

| Story | Established by | Outcome |
| --- | --- | --- |
| A write during a conflicted merge of an unrelated path exits 0, reports "persistence deferred: merge in progress in <checkout>", commits nothing until the merge concludes, then commits only the issue path | `persistence.test.ts` "a canonical merge defers persistence; merge includes issue: false" (HEAD unchanged while merging, issue file unstaged, after merge the follow-up commit touches only docs/issues/a.md, clean status) | held |
| A merge that itself commits the issue file leaves the persister nothing to do | same test with `includeIssue: true` (HEAD stays at the merge commit, result ok, status clean) | held |
| Wait is bounded like the live index lock | code review: `persistNow` shares `LIVE_LOCK_WAIT_MS` (10 min); on expiry it fails naming the operation and uncommitted paths | held |

Review run: `bun test persistence.test.ts` in the tracker scripts directory, 6 pass, 0 fail (2026-11-02). Code read for `operationInProgress` (per-checkout git dir, covers rebase-merge, rebase-apply, MERGE_HEAD, CHERRY_PICK_HEAD, REVERT_HEAD), the re-check after a failed commit attempt, and the foreground's deferral notice. No repairs were needed.
