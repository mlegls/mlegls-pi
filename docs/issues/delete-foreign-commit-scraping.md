---
stage: "idea"
assignee: "human"
priority: 2
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> Shells out to `bb plugin list`, `~/.pi/agent/settings.json`, and `git worktree list` every 5s tick; regex-scrapes SHAs out of prose/YAML; looped **303 times** on `attention-inbox-in-the-bb-tracker` and forced manual `reconcile_stop` when handoffs omitted `checkout`.
> **Cut**: Delete heuristic SHA scraping. If a ticket installs into another repo/plugin, verify that installation in the ticket's own review/check instead of policing global hex strings at close time.

Code: [foreign-work.ts](../../lib/reconcile/foreign-work.ts) (also has no error isolation per tick), [commit-handoff.ts](../../lib/commit-handoff.ts), [completion.ts](../../lib/reconcile/completion.ts#L218-L267). Related open issues: [[projects/mlegls-pi/issues/foreign-commit-hold-cannot-be-cleared-when-handoff-omits-checkout]], [[projects/mlegls-pi/issues/foreign-hold-drive-runtime-lacks-checkout-resolution-argument]]. Decide whether to cut.
