---
stage: "idea"
assignee: "agent"
author: "session:thr_ic9szhbyh9"
priority: 2
---
Observed in Concept's Review capture worker @thread:thr_ic9szhbyh9, 2026-10-22, while reporting the stopped [[projects/concept/issues/replay-review-quiz-by-default]] attempt. Owner: mlegls-pi's global vault tracker persister.

`issues.ts update replay-review-quiz-by-default --body-file .captures/review-quiz/approved-2026-10-22/ticket-body.md` returned: `Validated tracker working-tree write happened; persistence failed: fatal: cannot do a partial commit during a merge.` The validated capture outcome remains staged in Concept's canonical checkout. Concurrent read-only `git status --short` showed a large in-progress skeleton-loading integration plus the tracker path; canonical HEAD was `34fb4f12`. This is an observed merge-state publication refusal, not an index-lock error or evidence of a stale lock. No commit, merge, unstaging or lock deletion was attempted in the parent-owned checkout.

Related owner/history: [[projects/mlegls-pi/issues/tracker-publication-can-fail-after-validated-write-on-index-lock]] was fixed by detached persistence and live-lock waiting; the present failure is the separate canonical MERGE_HEAD/partial-commit boundary.

Workaround: retain the worker's committed evidence packet at `docs/attachments/replay-recordings-by-default-in-live-story-scripts/review-quiz.md`, preserve the validated canonical tracker write and report that publication is pending parent integration. Retry only after inspecting whether the concurrent merge already included it; do not blindly append or commit unrelated canonical paths.

Open question: how should global tracker persistence publish or safely defer an isolated issue mutation while its canonical checkout has an in-progress merge? A transactional merge-aware publication mechanism is not implemented here. No active Concept execution subtree contains this tooling idea.
