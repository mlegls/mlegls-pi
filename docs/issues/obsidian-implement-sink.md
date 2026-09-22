---
tags: [task]
stage: spec
assignee: agent
priority: 1
part-of: "[[projects/mlegls-pi/issues/home-ui]]"
---

first piece of the obsidian side beyond the comment sink: the implement-side actions (#implement on an efforts bullet, or the palette command on a block) launch a supervised Orca Pi session for it and leave a link in the note so the session can be attached from pi. from the vault outliner [[directing multi-agent work]].

- the palette entry / shell command pattern from lib/augment.ts, using the existing guarded write-back seam. Reconcile the legacy lib/vault.ts implement path, which still imports wm; launch through current route/dispatch admission with the issue’s assignee and readiness constraints.
- the link written under the bullet is the durable Orca dispatch/session receipt, enough to locate or resume the exact session without inventing a second registry.

done: from obsidian, invoking implement on an efforts bullet in the outliner creates the ticket, starts the worker, and writes the session link; attaching from pi works.
