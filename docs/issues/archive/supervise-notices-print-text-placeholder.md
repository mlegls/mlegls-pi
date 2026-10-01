---
stage: done
assignee: agent
priority: 3
author: session:01a0f324-32e8-732c-96ad-132d2d15485e
---

Superseded 2026-10-01 by [[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]]: `ab supervise` was deleted in the pi 0.99 rebuild (`4b79baa`).

Owner: `lib/jobs/supervise.ts`. Supervise notices (the steer hint around line 304 and the large-worker-session warning) still print `ab mail <address> TEXT`. [[projects/mlegls-pi/issues/archive/mail-reply-hint-placeholder-sent-as-body]] made `ab mail` refuse a body of exactly `TEXT` and changed the board reply hint to name the address only. Its worker left the supervise wording alone, because the refusal already catches a verbatim copy. Making these notices match the new hint, e.g. `<message>`, would stop the refused attempt from happening at all.
