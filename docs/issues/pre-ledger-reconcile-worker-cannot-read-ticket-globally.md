---
stage: "done"
assignee: "agent"
author: "session:01a130dd-e174-7067-b956-fd49d2068b45"
priority: 3
---
During the `query-sort-recent` Me history join, the dispatched worktree contains the ticket and integrated children, but the canonical tracker CLI returns `no issue query-sort-recent` and `no issue query-recent-merge`. Running from the owner checkout also cannot find either; the global parent tree shows no children. This is a live pre-ledger campaign: `activate-global-reconcile-runtime` explicitly forbids hot swapping its installed runtime, while the current worker instructions require global Tracker reads/writes only. The assigned contract supplied in the dispatch is the workaround; I made no branch-local tracker edits or guessed global claims. Observed from `/Users/mlegls/dev/mmon/concept__worktrees/query-sort-recent-implement-y` at source 30e01296. Reproduction: `bun ~/.pi/agent/skills/tracker/scripts/issues.ts text query-sort-recent` then `tree query-provenance-time-and-hub-data`. Owning repository/tool: mlegls-pi reconciler/tracker. This records legacy-campaign instruction/runtime mismatch, not a request to hot swap it mid-run.

## Result

Obsolete 2026-10-19: specific to a pre-ledger campaign during the global runtime switch (activate-global-reconcile-runtime, done).
