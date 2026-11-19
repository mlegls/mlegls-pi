---
stage: "done"
assignee: "agent"
author: "session:thr_paaif2gdr3"
---
The vault checker reports dangling links in `docs/issues/attachments/*.md`, but its global text/update operations only accept issue slugs. In a reconciled Common Concept worktree, opening one of these attachments is refused with “Use the global tracker”; `issues.ts text attachments/plan-lesson-live-a7ec68c` returns “invalid issue slug”. Five citations in three historical packets remain after their target guides moved. @thread:thr_paaif2gdr3

Done when: a worker can read a tracker attachment named by `check` and repair its link in the canonical vault through the tracker, without bypassing the worktree guard or weakening issue ownership.

## Result

done — Replayed the repair using the exact attachment path from `check`. The canonical commit changed only the attachment, the worker stayed clean, and the recheck found no remaining citation errors in that packet. The branch’s guard already names attachment locators when refusing a direct read. All 49 affected checks passed.

```yaml
commit: 86616801
stories:
  - story: Read and repair a tracker-reported attachment from a linked worker while preserving the worktree guard and issue ownership.
    outcome: held
evidence:
  path: docs/attachments/repair-links-in-tracker-owned-attachments/index.md
  visual: false
  shots: []
tests:
  - extensions/guard/index.test.ts
  - skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts
  - skills/enabled/all/mlegls/conventions/tracker/scripts/persistence.test.ts
  - lib/tracker-github.test.ts
filed: []
caveats: []
```

Evidence: [docs/attachments/repair-links-in-tracker-owned-attachments/index.md](../attachments/repair-links-in-tracker-owned-attachments/index.md)
