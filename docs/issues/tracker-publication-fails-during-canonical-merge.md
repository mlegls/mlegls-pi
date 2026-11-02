---
stage: "ticket"
assignee: "agent"
author: "session:01a16368-2fc8-718f-8be5-3cde6a9272ab"
priority: 3
drive: "none"
---
Owning tool/repository: mlegls-pi tracker vault persistence. During the Concept replay-learning-evidence-by-default handler's no-draw safety ruling on 2026-10-22 (session 01a16368-2fc8-718f-8be5-3cde6a9272ab), `issues.ts update capture-and-replay-current-go-learning-evidence --body-file -` validated/wrote the canonical issue but exited 1: `Validated tracker working-tree write happened; persistence failed: fatal: cannot do a partial commit during a merge.` A subsequent `issues.ts text` confirmed the entire new ruling/acceptance is globally readable. The chained parent update did not execute.

Read-only inspection showed Concept canonical MERGE_HEAD e125f4f1e03dc3fe1ffe417e2adf1e20ea1405ac and many staged skeleton-loading changes; the capture issue was MM. This establishes an in-progress canonical merge, not a stale lock. No merge/index manipulation, hook bypass or unrelated commit was attempted. Workaround: retain the validated global issue write, separately write the parent ruling, and report publication pending to the supervisor; the merge owner must finish its operation before tracker persistence can succeed. No successful publication/retry-after-merge is claimed.

This is distinct from completed tracker-publication-can-fail-after-validated-write-on-index-lock: that fixed stranded index locks, whereas the observed Git error rejects path-limited commit during MERGE_HEAD. Proposed improvement: coordinate/defer tracker publication around canonical merge state without committing another operation's staged files. Recovery policy is not established by this observation.

The same failure, filed separately from Concept's Review capture worker @thread:thr_ic9szhbyh9 (merged in from `tracker-publication-refuses-an-in-progress-canonical-merge`):

> Observed in Concept's Review capture worker @thread:thr_ic9szhbyh9, 2026-10-22, while reporting the stopped [[projects/concept/issues/replay-review-quiz-by-default]] attempt. Owner: mlegls-pi's global vault tracker persister.
> `issues.ts update replay-review-quiz-by-default --body-file .captures/review-quiz/approved-2026-10-22/ticket-body.md` returned: `Validated tracker working-tree write happened; persistence failed: fatal: cannot do a partial commit during a merge.` The validated capture outcome remains staged in Concept's canonical checkout. Concurrent read-only `git status --short` showed a large in-progress skeleton-loading integration plus the tracker path; canonical HEAD was `34fb4f12`. This is an observed merge-state publication refusal, not an index-lock error or evidence of a stale lock. No commit, merge, unstaging or lock deletion was attempted in the parent-owned checkout.
> Related owner/history: [[projects/mlegls-pi/issues/tracker-publication-can-fail-after-validated-write-on-index-lock]] was fixed by detached persistence and live-lock waiting; the present failure is the separate canonical MERGE_HEAD/partial-commit boundary.
> Workaround: retain the worker's committed evidence packet at `docs/attachments/replay-recordings-by-default-in-live-story-scripts/review-quiz.md`, preserve the validated canonical tracker write and report that publication is pending parent integration. Retry only after inspecting whether the concurrent merge already included it; do not blindly append or commit unrelated canonical paths.
> Open question: how should global tracker persistence publish or safely defer an isolated issue mutation while its canonical checkout has an in-progress merge? A transactional merge-aware publication mechanism is not implemented here. No active Concept execution subtree contains this tooling idea.

## shape

In `persistNow` ([issues.ts](../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts)), treat an in-progress operation in the canonical checkout (`MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `rebase-merge/`, `rebase-apply/` under the git dir) like a live index lock: the detached persister waits for it to end, polling, rather than failing. Once it ends, the persister commits its paths only if they still differ from HEAD; if the merge's own commit already included the validated write, there is nothing to commit and it exits 0. It never commits, aborts or unstages the operation's other files. The foreground command reports "persistence deferred: <operation> in progress in <checkout>" on stderr and exits 0, since the validated write is already globally readable (the working tree is the canonical tracker).

A wait bound: give up after the same bound the lock wait uses (or 30 minutes if it has none), leaving the working-tree write and printing what is uncommitted; `check` already reports uncommitted issue files.

Tests in `persistence.test.ts`: a write during a conflicted merge of an unrelated path exits 0, commits nothing until the merge is concluded, then commits only the issue path; a merge that itself commits the issue file leaves the persister nothing to do. `drive: none`: the tests are the acceptance.

decisions:
- 2026-11-02: merge the duplicate; defer persistence across an in-progress canonical operation, as for a live index lock, instead of failing or touching the operation (@thread:thr_dwre28wvm6).
