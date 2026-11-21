---
stage: "ticket"
assignee: "agent:auto-routine"
priority: 2
author: "session:thr_ihbpyrp6s2"
---

When a node was closed outside the run (the "closed outside the run while its chain runs" exception), move-out still sets the issue to `assignee: human`. The ticket is already done, so it lands on the human queue with nothing to do. Concept, 2026-11-22: keep-development-versions-on-main-as-prereleases (22082f474a) and heavy-queue-leaves-bun-cache-dirs-in-checkouts (30cbb62936); corrected by hand at c6557e38de. Move-out of a done node should retire the workers and leave the tracker alone.
