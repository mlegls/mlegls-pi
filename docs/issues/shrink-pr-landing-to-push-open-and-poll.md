---
stage: "idea"
assignee: "human"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p). The PR landing stack has had 0 production runs in mlegls-pi and carries real GitHub bugs; the audit's recommendation was to cut it rather than fix it:

> Keep PR mode to push branch → open/update PR → poll merge status (~100 LOC); let GitHub Actions/auto-merge and human review own the rest.

That covers ~953 LOC in [pull-request.ts](../../lib/reconcile/pull-request.ts), [pr-host.ts](../../lib/reconcile/pr-host.ts), [pr-diagnostics.ts](../../lib/reconcile/pr-diagnostics.ts) and [completion.ts](../../lib/reconcile/completion.ts), plus the GitHub tracker crash-WAL (~1,160 LOC, [tracker-github-write.ts](../../lib/tracker-github-write.ts), [tracker-github-state.ts](../../lib/tracker-github-state.ts)).

Bugs found, which a fix-in-place would have to address instead:
- squash/rebase merges on `pr-review` permanently brick `terminal()` / `completionTarget()` (pull-request.ts:126-127, completion.ts:188); pr-host.ts:212 hardcodes `merge_method: "merge"`.
- pr-diagnostics.ts:12-18 throws uncaught on relative/malformed `target_url` and on `gh run view --log-failed` while sibling jobs still run.
- pr-host.ts:47-155 fails on `check-runs` `total_count` drift, crashes on `commit: null` reviews, and runs N+1 GraphQL subprocesses per review thread every 60s.
- pull-request.ts:195-201 runs full `gates()` twice back-to-back per PR repair, and :339 requires full `stories` + `evidence` packets for a 1-line CI/review fix.

Decide: cut to the minimal PR mode, or keep and fix.
