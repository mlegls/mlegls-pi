---
stage: done
assignee: agent
author: session:97e2e1e0-915e-48c2-8bd3-0f9ecd53c817
part-of: "[[projects/mlegls-pi/issues/scripted-supervision-loop]]"
priority: 2
---

`lib/jobs/supervise.ts:integrateChild` merges a child's branch, then `close()` commits `stage: done` into the owner's checkout. Two failures seen supervising `~/dev/mmon/concept` with five loops against one checkout (2026-09-25):

- The close commit failed after a successful merge (`Command failed: git -C … commit -qm Close coalesce-tag-refresh-requests-with-coverage`), most likely because several loops' commit hooks (typecheck + lint) ran concurrently in the same checkout. The job died with the merged child still in `state.children`.
- Every restart then died with `spawn pi ENOENT`, thrown from `@getpaseo/client` `fetchAgentTimeline` via `lib/children.ts:147`: the carried state still named the merged child's verifier, already retired, and Paseo's daemon fails to resurrect a retired agent to read its timeline. Recovery took hand-editing the job's state file and `ab daemon shutdown`.

Done looks like: a ticket's close rides its branch (commit `stage: done` in the child's worktree before merging, as the vault tracker's procedure already says: "the ticket's completion and archival ride its implementation branch"), so integration is one merge and nothing else writes the owner's checkout; and a child whose handle no longer resolves (retired, deleted, timeline unreadable) is surfaced to the owner as an exception or dropped, not a fatal job error, so `start` can always continue from state. Concurrent loops merging into one checkout must not race each other (serialize merges across jobs in the daemon, or equivalent).

Use: two loops on one checkout integrate children at the same moment; both close; kill a merged child's agent and restart a loop whose state still names it, and the loop continues.

September 26: closure now commits in the rebased child before the owner's fast-forward. Optional integration preparation uses the existing dispatch path; `--test` runs there rather than after merging into the owner. Failures leave the child available and do not move the owner HEAD. Completion is saved before either child is retired. Existing per-repository serialization now canonicalizes symlink aliases. Resume-operation errors become owner exceptions rather than fatal job errors; missing worktrees and reported worker exits are parked as unreachable. Blind integration retries were removed: preparation/test commands are not assumed safe to repeat automatically.

The current transport is workmux/board, not the historical Paseo timeline path. A real-Git fixture runs two loops concurrently through one checkout and a symlink alias, checks branch-local close commits and save-before-retire, and injects failed tests, a rejected close commit hook, and a carried missing worktree. Tracker discovery and worker transport are stubbed; no active daemon or workers were touched. A separate child-adapter test checks reported exits become unreachable. Actual live daemon restart/worker death was not exercised.

Accepted limits: the daemon lock does not coordinate human/external writers; an outside commit may cause a surfaced fast-forward failure. Crash after saved completion can leave cleanup resources behind. Restart with an existing worktree but undiscoverable pane needs separate investigation: [workmux reattachment provenance](wm-reattachment-loses-worker-repository.md). Closing this issue resolves branch closure/order and the tested recovery paths, not all host recovery.
