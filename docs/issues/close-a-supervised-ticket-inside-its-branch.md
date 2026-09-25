---
stage: ticket
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

Seen live while finishing this ticket (2026-09-25):

- close() replaced `^stage: \w+$` only, so a parent issue that omits stage (valid when all its work is delegated) got no `stage: done` and nothing to commit; the line is now inserted into the frontmatter when absent.
- An implementer ending done with caveats: [] but every story unobservable went straight to verify; an implement handoff whose stories are all unobservable is now an exception, like caveats.
- redispatch retired the child but kept its branch `<ticket>/<child>`; the relaunch's worktree add then failed on the taken name (cannot lock ref). Redispatch now deletes the branch when it holds nothing beyond HEAD, and launches otherwise take the next free `<ticket>/<handle>`.
- A wake to the owner mid-run ("Cannot replace agent … active run cancellation was not acknowledged") killed the job; wakes now retry, then queue in state and drain on the next wake or restart. A child supervisor's closed check-ins (turn end kind closed, no sentinel) no longer wake the owner.
