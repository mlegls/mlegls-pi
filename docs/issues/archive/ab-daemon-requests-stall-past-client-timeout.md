---
stage: done
assignee: agent
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
priority: 3
---

Obsolete 2026-10-01: the ab daemon and its `ab mail`/`ab service`/`ab check` commands were deleted in the pi 0.99 rebuild (`4b79baa`). Mail is the `mail` and `board_*` tools now; nothing replaces `ab service` or `ab check` yet.

Several Concept reviews on 2026-09-28/29 saw `ab: timed out talking to ab daemon` while checks were queued or running (execution receipts in [[projects/mlegls-pi/issues/archive/ab-check-loses-waiter-after-daemon-timeout]]). That ticket made the waiter survive the timeout; its verification injected the pause rather than reproducing it, and why the daemon stops answering requests for 30s+ is unestablished. Candidates: event-loop blocking in a job module (supervise loops, check admission) or synchronous I/O under many concurrent jobs. Next step: time daemon request handling under a real multi-job load and record where it blocks.

During Concept's `redrive-browser-interface-and-account-isolation-regressions` first use (session `01a0f326-3218-75ff-8201-790bf5ae14d9`, 2026-09-30), `ab check` execution `742e329d-ead1-4f9f-9a58-47efa92292b0` lost the daemon socket after two of ten passing Playwright repetitions: `ab: connect ENOENT /Users/mlegls/.local/state/ab/daemon.sock`, exit 2. Its report was incomplete, and a subsequent `ab service list --status running,queued` returned no services; the three owned endpoints no longer answered. This is a missing-daemon observation, not evidence of the earlier request-stall cause. The workaround was to stop remaining checkout-owned processes, clean up the interrupted persona, restart owned services and rerun with a fresh output directory; the interrupted repetitions were not counted as the requested run. Concept's ticket packet retains the reproduction and recovered outcome.
