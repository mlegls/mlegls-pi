---
stage: idea
assignee: agent
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
priority: 3
---

Several Concept reviews on 2026-09-28/29 saw `ab: timed out talking to ab daemon` while checks were queued or running (execution receipts in [[projects/mlegls-pi/issues/ab-check-loses-waiter-after-daemon-timeout]]). That ticket made the waiter survive the timeout; its verification injected the pause rather than reproducing it, and why the daemon stops answering requests for 30s+ is unestablished. Candidates: event-loop blocking in a job module (supervise loops, check admission) or synchronous I/O under many concurrent jobs. Next step: time daemon request handling under a real multi-job load and record where it blocks.
