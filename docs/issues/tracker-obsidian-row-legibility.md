---
stage: idea
author: session:tracker-obsidian-views-review-1
---

From the first-use drive of [[projects/mlegls-pi/issues/tracker-obsidian-views]] ([packet](../attachments/tracker-obsidian-views/index.md)):

- `own done · tree ticket` looks contradictory until one understands own vs subtree stage. The review added hover titles (`own stage · subtree stage`, `priority unset`), but the visible text is unchanged.
- Done rows are so dim they look disabled.
- Reopening `Tracker.base` selects its first saved view (Tree), not the last one used (Network). Obsidian owns this; a `Tracker.base#Network` link opens the chosen view.

Open question: should the row show the two stages differently (e.g. only the subtree stage, with own stage when it differs), and should done rows use a strike or check rather than low opacity?
