---
stage: "ticket"
assignee: "agent"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> `claimLive()` in [issues.ts](../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts#L570-L580) only checks legacy `run_*`/`next` claims (misses modern `session:`/`reconcile:` stale claims)

Done when `check` and the listings mark `reconcile:<root>[/<handle>]` claims stale when `<root>`'s run state in the git common dir's `reconcile/` is finished or its pid is gone, and `session:<id>` claims stale when no worktree, run or live bb thread holds them (the bb lookup may be skipped when bb isn't reachable, leaving the claim unjudged).
