---
stage: "done"
assignee: "agent:auto-routine"
priority: 2
author: "session:thr_ihbpyrp6s2"
---

When a node was closed outside the run (the "closed outside the run while its chain runs" exception), move-out still sets the issue to `assignee: human`. The ticket is already done, so it lands on the human queue with nothing to do. Concept, 2026-11-22: keep-development-versions-on-main-as-prereleases (22082f474a) and heavy-queue-leaves-bun-cache-dirs-in-checkouts (30cbb62936); corrected by hand at c6557e38de. Move-out of a done node should retire the workers and leave the tracker alone.

## Result

done — Move-out retired the worker, removed its checkout, and preserved the closed ticket byte-for-byte, including its stored worker claim. The final notice now reports external closure without claiming a landing. All targeted checks passed; the fixtures were stopped.

```yaml
commit: f26953b2
stories:
  - story: Moving out an externally closed node retires its worker without changing the tracker.
    outcome: held
evidence:
  path: docs/attachments/move-out-of-a-closed-node-assigns-it-to-human/index.md
  visual: false
  shots: []
fixed:
  - "991e708c: Require a recorded root landing before announcing one."
  - "dded66ed: Skip closed issues when releasing retired workers’ claims."
tests: []
filed:
  - docs/issues/move-out-of-only-closed-node-announces-landing.md
caveats: []
```

Evidence: [docs/attachments/move-out-of-a-closed-node-assigns-it-to-human/index.md](../attachments/move-out-of-a-closed-node-assigns-it-to-human/index.md)
