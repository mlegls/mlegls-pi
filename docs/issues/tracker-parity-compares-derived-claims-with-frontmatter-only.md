---
stage: idea
author: session:01a0f091-86ac-707b-bf11-1aa6cacae98c
---

During [[projects/mlegls-pi/issues/tracker-obsidian-views]], `TRACKER_PROJECT=/Users/mlegls/dev/mlegls-pi TRACKER_VAULT=/Users/mlegls/obsidian bun test lib/tracker-views.test.ts` failed at line 99 for `ab-check-loses-waiter-after-daemon-timeout`: model frontier true, CLI frontier false. The project/vault identities match. The CLI includes derived inflight claims; the Obsidian model is intentionally pure over note paths and frontmatter and has no runtime claim source.

The ordinary suite passes (four tests, parity skipped). No readiness semantics were changed to hide the difference. The parity seam needs to distinguish metadata parity from runtime dispatch eligibility, or supply an explicit runtime projection without making the pure model depend on processes. Owner: `lib/tracker-views.test.ts` and tracker snapshot integration.
