---
tags: [task]
next: implement
priority: 1
parent: home-ui
---

first piece of the obsidian side beyond the comment sink: the implement-side actions (#implement on an efforts bullet, or the palette command on a block) spawn a workmux pi session for it and leave a link in the note so the session can be attached from pi. from the vault outliner [[directing multi-agent work]].

- the palette entry / shell command pattern from lib/augment.ts, calling lib/vault.ts's implement path (it already creates the ticket and dispatches a worker via wm.spawn).
- the link written under the bullet is the run/handle (`session:: frontier/…/<handle>`), enough to `/jump` or `wm.capture` it from any pi session.

done: from obsidian, invoking implement on an efforts bullet in the outliner creates the ticket, starts the worker, and writes the session link; attaching from pi works.
