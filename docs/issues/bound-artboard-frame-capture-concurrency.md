---
stage: "ticket"
assignee: "agent"
priority: 4
author: "session:draw-session-map-and-graph-diff-node-marks-implement-1"
---
The artboard skill's `scripts/canvas.ts` captures every frame of a layout at once (`Promise.all` over all frames in one browser), each waiting at most 30s for `#storybook-root > *`.

Observed 2026-10-24 building a 22-frame page of Storybook frames from a concept worktree against its dev Storybook, with host load average ~50 (shared with other workers): the build threw `TimeoutError: waitForSelector: Timeout 30000ms exceeded` at canvas.ts:153 on every retry (five attempts, ~45s each), though the same stories rendered in under 10s when opened one at a time. A 12-frame page built fine minutes earlier. Stories warmed by opening them serially first did not help.

Workaround used: a copy of canvas.ts whose capture loop is a pool of 3 workers (`ARTBOARD_CONCURRENCY=3`); the 22 frames then built in 90s.

Proposal (not done): read `ARTBOARD_CONCURRENCY` (default: all, as now, or a modest 6) and run the capture as a bounded pool; also surface the failing frame's name in the timeout error (today only the stack names `capture`).