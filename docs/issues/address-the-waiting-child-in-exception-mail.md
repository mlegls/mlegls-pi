---
stage: idea
assignee: agent
author: session:01a0e5e9-67b7-732e-90ce-7e6ac7a4ad76
---

Owner: `ab supervise` exception mail and `ab mail` topics. Exception mail says "Steer it directly (its next turn end returns to the loop)" but gives no address. The obvious guesses fail silently:

- `ab mail ticket/<repo>/<slug>-review-1` returns a message id, but no session listens on that topic. Reviewers subscribe only to their mailbox and `wt/<repo>/<branch>`.
- `ab mail ticket/<repo>/<slug>` reaches the implementer, not the reviewer the loop is waiting on. The implementer does the requested work on its own branch, which the loop never reads.

In the Concept tend session of 2026-09-28/29, six owner steers were lost this way (find-why-clerk, keep-at-latest ×2, present-applet ×2, count-getting-started), and two more (keep-out, server-render) went to implementers. Jobs sat at `waiting: needs-input` for 6 h and `waiting: blocked` for 20 h, and the owner believed they had been answered.

Fix: print the waiting worker's exact address (`mail/<hex>` or `wt/<repo>/<branch>`) in exception mail. Make `ab mail` fail or warn when a topic has no live subscribers. Either route `ticket/` channels to the worker the loop is waiting on, or subscribe every phase worker to its ticket.
