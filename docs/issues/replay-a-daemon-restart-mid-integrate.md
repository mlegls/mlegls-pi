---
stage: idea
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/supervise-loop-reliability]]"
author: session:01a0f324-32e8-732c-96ad-132d2d15485e
---

`lib/jobs/supervise.ts` re-enters integration on startup for a child whose `integrating` flag (or accepted head with no waiting exception) survived a daemon restart (the `integrate-resumed` trace). No replay covers this path. [[projects/mlegls-pi/issues/supervise-status-shows-each-jobs-running-services]] now surfaces the flag in status but its implementer noted the restart-mid-integrate resume has no dedicated replay.

Supervisors currently avoid the path by checking `*.events.jsonl` for an unfinished integrate-start before restarting the daemon. A replay would show whether that check is still needed: seed a job, kill the daemon between integrate-start and integrate-done (both the plain and the decompose branch), restart, and observe one integration with no duplicate merge or lost turn end.
