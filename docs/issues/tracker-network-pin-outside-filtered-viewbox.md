---
stage: idea
author: session:01a0f227-6a60-775b-8d17-d8ee02ba0643
---

During [[projects/mlegls-pi/issues/archive/tracker-obsidian-rollout]] first use on the live vault, dragging `tracker-obsidian-rollout` saved its pin at `[1665,1129]` in the full Network. Searching `tracker-obsidian` reduced the graph to three nodes with SVG `viewBox="0 0 900 600"`; the same pinned node was outside the pane (circle center about `[1553,978]`, pane right edge 1001). Clearing the search and returning from its issue note retained the saved pin at `[1665,1129]`. Double-click unpinned it, restoring the user's original empty pins.

Owner: `extensions/obsidian-tracker/graph.ts`. The pin is preserved, but narrowing the graph changes its coordinate frame and can hide it. No renderer change was made in the rollout-owned branch. [Encounter](../attachments/tracker-obsidian-rollout/index.md).
