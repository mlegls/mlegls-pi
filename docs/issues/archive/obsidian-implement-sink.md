---
tags: [task]
stage: done
assignee: agent
priority: 1
part-of: "[[projects/mlegls-pi/issues/archive/home-ui]]"
---

The implement-side actions (#implement on an efforts bullet, or the palette command on a block) launch supervised work and leave a link in the note so the session can be attached from pi. From the vault outliner [[directing multi-agent work]]. Use the current workmux dispatch backend ([[projects/mlegls-pi/dispatch]]), not the retired Orca adapter.

- the palette entry / shell command pattern from lib/augment.ts, using the existing guarded write-back seam. Reconcile the legacy lib/vault.ts implement path, which still imports wm; launch through current route/dispatch admission with the issue’s assignee and readiness constraints.
- the link written under the bullet is the current dispatch receipt (`handle`, `run`, `path`), enough to locate or resume the exact worker without inventing a second registry.

done: from obsidian, invoking implement on an efforts bullet in the outliner creates the ticket, starts the worker, and writes the session link; attaching from pi works.

disposition, 2026-09-30: dropped with the interactive Obsidian cockpit. mlegls: "i've moved away from that, realizing it's a bit overengineered. my general workflow now is to type everything on my mind into a single "top of mind" document … and then i just ask inside a chat harness to process it". The tracker views stay ("the tracker is actually useful. i just don't need obsidian to be super "interactive""). Unmerged work stays on branch `obsidian-implement-sink` (command-path fixes `bfc5163`, review notes `7f104db`); the palette story was never verified.
