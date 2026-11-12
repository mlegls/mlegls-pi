---
stage: "done"
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

Independent CLI verification: [predictions, encounter and replayable checks](../attachments/life-compactor-lease-outlives-its-builder/drive-2.md), tested at ce349347. Startup discard, orderly shutdown, SIGKILL recovery and failed-build release/retry held on disposable playgrounds. The empty-reply warning remains owned by [[projects/mlegls-pi/issues/life-first-use-compaction-empty-reply-warning]].

## Result

done

I reviewed the change since 4cced27f against the ticket and the driver's packet. I found no defects and made no repairs or new commits. `bun test extensions/context/life` passes 14 of 14. The repo declares no `test:affected` task, so I ran that directory directly.

**What I checked**
- **Lease end records (`extensions/context/life/build.ts`):**
  - A `life.lease.end` record is written when a build finishes or fails, and when a Chat is disposed. Disposal covers the startup discard and session shutdown.
  - The `dispose()` loop deletes from the `leases` map while iterating it. That is safe.
  - A lease still waiting at disposal is also released.
- **Election query:** it skips ended leases and leases whose pid is gone, via `process.kill(pid, 0)`.
  - A lease with no pid still expires after ten minutes, so leases already in the real store keep working.
  - The `tags_kv` index covers the lookup, so the query is cheap.
- **Waiting:** a waiter on a lease that has a pid re-checks every second, and re-queues immediately when the store revision changes. This removes the `waitSeconds` stall behind a dead holder.
- **Driver's packet:**
  - Startup discard, orderly shutdown, SIGKILL recovery and failed-build retry are all backed by record timestamps in `drive-2.md`. The SIGKILL sibling reclaimed the keys within 1 s, and a failed key was rebuilt before its original expiry.
  - SIGTERM exits without releasing, but the pid check recovers it.
- **Tracker friction:** the only friction is the empty-reply warning. It stays with the existing issue `life-first-use-compaction-empty-reply-warning` (idea, p3), where the driver already added evidence. Nothing new to file or close.

```yaml
commit: abe7529a
stories:
  - story: Startup-discarded Chat returns its leases and imported lines drain
    outcome: held
  - story: Orderly session shutdown returns held leases
    outcome: held
  - story: SIGKILL holder permits sibling rebuilding within about one minute
    outcome: held
  - story: Gone holders do not impose the first-request waitSeconds stall
    outcome: held
  - story: Failed build releases its lease and later sessions rebuild before expiry
    outcome: held
evidence:
  path: docs/attachments/life-compactor-lease-outlives-its-builder/drive-2.md
  visual: false
  shots: []
tests:
  - extensions/context/life/build.test.ts
filed: []
caveats:
  - "Liveness is a local pid check, so it assumes every session of a life shares one host and pid namespace. A reused pid makes a dead holder look alive until the ten-minute expiry."
  - "Cost of the pid check: a waiter on a lease with a pid re-queues once a second, plus on any store change. This is a cheap indexed query; no wall-time measure was taken."
  - "A SIGTERMed holder leaves its claims unended and is recovered only by the pid check. A very short run can end before higher-level summaries drain; the key stays available and a later session builds it."
  - "The empty-reply warning can still add roughly 30 s to a run independently of dead-holder recovery. It is owned by life-first-use-compaction-empty-reply-warning."
  - "proposed test: none."
```

Evidence: [docs/attachments/life-compactor-lease-outlives-its-builder/drive-2.md](../attachments/life-compactor-lease-outlives-its-builder/drive-2.md)
