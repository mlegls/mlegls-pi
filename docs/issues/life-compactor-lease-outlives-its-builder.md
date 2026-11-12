---
stage: "ticket"
assignee: "agent"
author: "session:life-session-attachment-and-run-context-review-d"
priority: 2
---
A `life.lease` is honored for ten minutes even after its builder has exited or failed. In the [[projects/mlegls-pi/issues/life-session-attachment-and-run-context]] driver's store (`/tmp/pi-life-hgWnTO`, kept for replay) leaf 37 was claimed at 03:32:43 by a session that was then stopped; every later session lost the election to that lease and waited, so the summarized frontier sat at 37 until 03:42:43 while 50 later messages arrived. While the frontier is stuck, each run's first request waits the full `waitSeconds` (30 s), and a long run cannot move its boundary (the view only advances over summarized history).

The review pass made later compactor calls keep their nearest messages as context and stopped repeated waits within a run; the first request still pays 30 s per run, and the tree stays unbuilt until expiry.

Open choice: release the lease when its builder fails or its session shuts down (a `life.lease` end record, as presence does for runs), shorten the lease with a heartbeat, or let a waiting sibling take over after a pid check (leases carry no pid today). Compactor design belongs to [[projects/mlegls-pi/issues/life-compacts-one-shared-tree]], which is where the ten-minute lease was chosen.

Real Concept Engineering setup reproduces the lease stall without an exited process: BB thread thr_9hjpcsjipp (pi session pi_8a68ce38-09d6-4f8a-8ecd-1bf36bfc3cc1), installed main 0b11e6c3, attached to /concept-engineering after importing 277 Hermes messages. Eight leaves (1,4,7,9,11,14,15,17) were leased at 2026-11-12T05:12:53.903–.920Z, then each leased again at .935Z onwards. At 05:16:10Z all other longer imported leaves were built but those eight still lacked nodes. The process remains alive; attachment startup discards a Chat while its requests have already claimed leases (index.ts change/session_start both call synced). No empty-reply warning is present in the recorded session. Workaround: keep the session alive until the ten-minute leases expire. Setup receipts: docs/attachments/concept-engineering-named-agent-setup/progress-and-recall.txt on the setup worker branch; the lease timestamps were queried from life.lease records keyed by /concept-engineering, fanout 2, level 0 and the eight positions.

decisions:
- 2026-11-12: this is fixed during Concept Engineering's trial week ([[projects/mlegls-pi/issues/concept-engineering-runs-as-a-life-on-the-beelink]]), priority 2: the maintainer starts using the life today, and starting a second thread soon after a first one finishes is the ordinary case that leaves lines leased by nobody. The bar is the behaviour under done-when; which of the three mechanisms meets it is the implementer's choice and needs no further answer from the owner (concept-strategy, as owner).

## shape

Reproduce both recorded cases on a playground store (`scripts/life-playground.ts`), never on the real `/concept-engineering` records: a session stopped while it holds a lease, and a session attaching to a life that has unbuilt longer lines, whose startup discards the Chat that claimed them. Leads are in the body above (`index.ts` change/session_start both call synced; leases carry no pid). The real life is in use, so leases already written in a store stay readable and still expire.

done-when:
- a holder that stops building for any reason it can see (its build fails, its session shuts down, its Chat is discarded) gives its leases back, and the next run in any thread of that life builds those lines without waiting for expiry.
- a holder that is killed outright doesn't hold the lines for ten minutes either: another session of the life builds them within about a minute.
- a run's first request doesn't wait `waitSeconds` on a lease whose holder is gone.
- the real setup's reproduction (attach to a life with unbuilt longer lines) leaves no line unbuilt once the first session's compactor has drained, with the session free to end.
