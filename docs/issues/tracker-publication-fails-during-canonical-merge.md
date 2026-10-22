---
stage: "idea"
assignee: "agent"
author: "session:01a16368-2fc8-718f-8be5-3cde6a9272ab"
priority: 3
---
Owning tool/repository: mlegls-pi tracker vault persistence. During the Concept replay-learning-evidence-by-default handler's no-draw safety ruling on 2026-10-22 (session 01a16368-2fc8-718f-8be5-3cde6a9272ab), `issues.ts update capture-and-replay-current-go-learning-evidence --body-file -` validated/wrote the canonical issue but exited 1: `Validated tracker working-tree write happened; persistence failed: fatal: cannot do a partial commit during a merge.` A subsequent `issues.ts text` confirmed the entire new ruling/acceptance is globally readable. The chained parent update did not execute.

Read-only inspection showed Concept canonical MERGE_HEAD e125f4f1e03dc3fe1ffe417e2adf1e20ea1405ac and many staged skeleton-loading changes; the capture issue was MM. This establishes an in-progress canonical merge, not a stale lock. No merge/index manipulation, hook bypass or unrelated commit was attempted. Workaround: retain the validated global issue write, separately write the parent ruling, and report publication pending to the supervisor; the merge owner must finish its operation before tracker persistence can succeed. No successful publication/retry-after-merge is claimed.

This is distinct from completed tracker-publication-can-fail-after-validated-write-on-index-lock: that fixed stranded index locks, whereas the observed Git error rejects path-limited commit during MERGE_HEAD. Proposed improvement: coordinate/defer tracker publication around canonical merge state without committing another operation's staged files. Recovery policy is not established by this observation.

