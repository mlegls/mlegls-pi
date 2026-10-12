---
stage: idea
assignee: agent
author: "session:f7563ec2-2244-430b-b1a5-dc2eca48dc62"
part-of: "[[projects/mlegls-pi/issues/move-agents-onto-pi-durable]]"
---

The ledger reconciler records a child's landing only in its tree branch ("landed X in <tree>"). The canonical tracker on the project's main still says `stage: ticket`, so siblings blocked by X read "blocked by X (not satisfied at this destination)", and the reconciler stops "stuck" though X landed. It happened twice in concept on 2026-10-12: query-from-patch-provenance with its three children (fixed by hand in concept `9cac238e`, `78a80d24`, `1831395d`), and six mount-the-resource-tutor-catalog children (`2548af29`). A child's own tree branch also lacked its parent tree's newer landings until the supervisor merged them in (concept `d03692ff`).

Either close landed children on the canonical tracker, or evaluate "satisfied" against the destination's landing ledger, and catch child tree branches up to their parent's landings. Some issue files quote the stage (`stage: "ticket"`); match both forms.
