---
stage: "ticket"
assignee: "agent"
author: "session:thr_paaif2gdr3"
---
The vault checker reports dangling links in `docs/issues/attachments/*.md`, but its global text/update operations only accept issue slugs. In a reconciled Common Concept worktree, opening one of these attachments is refused with “Use the global tracker”; `issues.ts text attachments/plan-lesson-live-a7ec68c` returns “invalid issue slug”. Five citations in three historical packets remain after their target guides moved. @thread:thr_paaif2gdr3

Done when: a worker can read a tracker attachment named by `check` and repair its link in the canonical vault through the tracker, without bypassing the worktree guard or weakening issue ownership.
