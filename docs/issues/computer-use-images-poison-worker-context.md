---
stage: ticket
assignee: agent
priority: 2
part-of: "[[projects/mlegls-pi/issues/supervise-loop-reliability]]"
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

The first [[projects/mlegls-pi/issues/archive/tracker-obsidian-rollout]] worker drove Obsidian with repeated screenshots and accessibility dumps loaded into its context. Its session reached 56 MB, and from 2026-09-30 05:29Z every turn failed with `{"detail":"Bad Request"}` from the provider. Steering it with mail made it worse: each new turn added to the same rejected context, and it died again at 11:44Z right after loading a SKILL.md. Only `ab supervise resume … redispatch` (a new pi session on the same branch) recovered it.

Nothing warns before a session gets into this state, and the drive/review roles don't say to save captures to files instead of viewing them. Possible owners: the computer tooling (return a file path rather than inline image content by default), the worker roles, or a size/image-count watch in `lib/jobs/supervise.ts`. Detecting the resulting silent death is [[projects/mlegls-pi/issues/parent-waits-on-worker-that-died-without-a-report]].

ticket contract, 2026-09-30: workers can't silently grow a session the provider will reject. The drive, review and implement roles say to save screenshots and accessibility dumps to files and load an image only when judging it; and the loop warns the owner once when a worker's session file passes a size threshold (for example 20 MB), naming the session, so the owner can steer or redispatch before it dies.

## Result

First-use drive: [evidence packet](../attachments/computer-use-images-poison-worker-context/index.md). All three role instructions contain the capture guidance. The supplied regression entry point passed, but did not expose the oversized-session scenario; owner-warning and once-only behavior remain unobservable pending reproducible setup.
