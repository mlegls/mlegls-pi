---
stage: ticket
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/supervise-loop-reliability]]"
author: session:01a0f324-32e8-732c-96ad-132d2d15485e
---

Owner: `ab supervise` integrate. When main moves while an accepted child waits, the fast-forward fails. The owner has to steer `git rebase main`, and then the loop refuses with "accepted review of current head required", which costs another steer and sometimes a re-review. The Concept root supervisor carried this as a standing manual fix through 2026-09-30.

Fix: on divergence with no conflicts, integrate rebases the child onto the target itself. If the child's own diff is the same before and after (`git diff <old-base> <old-head>` equals `git diff <new-base> <new-head>`), it keeps the review's acceptance and proceeds. Only a changed diff goes back to verify. Conflicts stay with [[projects/mlegls-pi/issues/probe-conflicts-and-prepare-deps-around-integrate]].
