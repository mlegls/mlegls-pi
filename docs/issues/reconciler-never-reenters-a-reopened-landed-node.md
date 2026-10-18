---
stage: idea
assignee: agent
author: "session:f7563ec2-2244-430b-b1a5-dc2eca48dc62"
part-of: "[[projects/mlegls-pi/issues/move-agents-onto-pi-durable]]"
---

A node the ledger has recorded as landed stays landed after the tracker reopens it. In concept on 2026-10-18, `compare-the-remaining-main-page-frames-on-desktop-and-phone` (run `bring-the-application-to-the-main-pages-design`) was landed in the ledger at `0f19cde0`, then moved out to a human goal, then returned to `stage: spec` under the parent with seven new ready children blocking it (concept `c9c26936`, filed by the parent's implementer at `590be909`). The reconciler only reran the parent's implement, which correctly reported "blocked — child scheduling is required"; none of the seven children were launched.

A node whose tracker state is no longer done should be treated as open again and its children scheduled, or `reconcile_resolve` should offer a reopen action.

Also seen in the same run: a tick threw `git merge-base --is-ancestor 0cfefc3e HEAD` exit 1 from `lib/reconcile/checks.ts` `isAncestor` (retrying every 5s) instead of reading exit 1 as "not an ancestor".
