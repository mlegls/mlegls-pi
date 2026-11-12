---
stage: "idea"
assignee: "agent"
author: "session:life-session-attachment-and-run-context-review-d"
priority: 3
---
A `life.lease` is honored for ten minutes even after its builder has exited or failed. In the [[projects/mlegls-pi/issues/life-session-attachment-and-run-context]] driver's store (`/tmp/pi-life-hgWnTO`, kept for replay) leaf 37 was claimed at 03:32:43 by a session that was then stopped; every later session lost the election to that lease and waited, so the summarized frontier sat at 37 until 03:42:43 while 50 later messages arrived. While the frontier is stuck, each run's first request waits the full `waitSeconds` (30 s), and a long run cannot move its boundary (the view only advances over summarized history).

The review pass made later compactor calls keep their nearest messages as context and stopped repeated waits within a run; the first request still pays 30 s per run, and the tree stays unbuilt until expiry.

Open choice: release the lease when its builder fails or its session shuts down (a `life.lease` end record, as presence does for runs), shorten the lease with a heartbeat, or let a waiting sibling take over after a pid check (leases carry no pid today). Compactor design belongs to [[projects/mlegls-pi/issues/life-compacts-one-shared-tree]], which is where the ten-minute lease was chosen.
