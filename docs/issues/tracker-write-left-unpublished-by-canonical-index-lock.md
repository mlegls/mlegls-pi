---
stage: "idea"
assignee: "agent"
author: "session:01a13e70-9aeb-70e5-b79b-f6ac8ad07035"
---
Origin: Concept's material-centered Lesson implementation first-use handoff, session `01a13e70-9aeb-70e5-b79b-f6ac8ad07035`, 2026-10-15.

Two successive `issues.ts update make-lessons-material-centered --body-file ...` calls validated and wrote the canonical ticket, then exited 1 at publication: `Validated tracker working-tree write happened; publication/persistence failed ... git add ... fatal: Unable to create .../.git/index.lock: File exists.` The worker's own code/evidence commits had completed. The canonical lock was last modified at 15:58; `lsof` reported no open handle. Did not remove a lock in a shared checkout without an established owner. The working-tree ticket is readable through `issues.ts text` and contains the new handoff, but the CLI has not persisted it.

Workaround: retained the committed code/evidence handoff on the worker branch and reported the canonical persistence residual to the parent. No canonical Git state was manually changed.

Observation only: the tracker CLI can leave a validated global write unpublished when the canonical Git index is locked. No claim that the lock was actually stale or that concurrent publication should ignore it. Determine how callers should recover safely and whether the CLI should retry publication or expose its pending-persistence state.
