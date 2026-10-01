---
stage: idea
author: session:b8c305ef-a0b0-41ad-9c26-1a43247c6129
---

A steer to a worker after its done report must not silently disappear from the delivered change.

Concept's root supervisor (`mail/2d15485e`) observed on 2026-10-01: retry-transient's implementer reported done, received a steer next, and committed `7e3292a0`. Drive and review had already started from the HEAD at report time, so that commit never landed. The run predates 0be483a; current `lib/reconcile/reconcile.ts` still snapshots the phase source HEAD in `startPhase` and keeps previous workers until integration. The thread cutover does not fence completed phases or route their mail back to the owner.

Choose the handoff policy: bounce mail to the owner once a handle's phase ended, or detect post-report changes and block/restart downstream phases. Include the race between report consumption, steer delivery and committing; a HEAD check alone does not settle it.
