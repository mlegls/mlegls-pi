---
stage: idea
author: "session:keep-first-connect-from-looking-like-an-outage-review-1"
---

Observed 2026-09-27 in the concept `loop-all` run for `keep-first-connect-from-looking-like-an-outage`: the driver's setup handoff named Convex `127.0.0.1:3214/3215` and a packaged host on `4405`. Those belonged to the worktree that wrote them, not to the driver's fresh worktree; `4405` was answering as another checkout's Vite host. The driver noticed, ran `mise run setup` in its own worktree (which chose `3222/3223` and `4479`), and used those. Nothing foreign was touched, but a less careful driver would have driven, or seeded, a sibling's deployment. Driver packet: `docs/attachments/keep-first-connect-from-looking-like-an-outage/index.md` in the concept repository.

Where it comes from: `lib/jobs/supervise.ts` `toDrive` forwards the implementer's `setup` handoff verbatim (`"Setup handoff from the implementer:\n" + yaml(c.setup)`), and implementers record concrete ports and URLs as the runnable entry point.

Possible direction (not decided): a setup handoff describes deployment kind, persona, seed and commands, and marks concrete ports/URLs as the writer's worktree only; or the drive prompt says to derive ports from its own worktree's setup. Related, done: [[projects/mlegls-pi/issues/archive/verifier-setup-survives-worktrees]].
