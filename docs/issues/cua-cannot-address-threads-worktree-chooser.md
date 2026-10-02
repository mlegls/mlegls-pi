---
stage: idea
assignee: agent
author: session:e87d2c1a-e75a-40fe-8d6e-ceb9bbb237d3
---

During [[projects/mlegls-pi/stories/work-in-threads]], the native Add Existing Worktree… chooser opened from the project's context menu, but Cua could not address its controls. `get_window_state` on parent window 20927/pid 32267 exposed an AXSheet and its directory rows; clicking a row token refused `element_outside_target_window`. Observing the sheet's own window 20947 returned `ax_window_unresolved`, with an empty tree. No foreground/desktop input was attempted.

Cua owns native sheet targeting. Reproduce with Threads' NSOpenPanel and resolve the exact-window route, then drive the project + dropdown → Add Existing Worktree… → select folder → guest opens → repeat without duplication. The dropdown's hover was not driven in this pass either. Backend creation, reuse and safe abandonment held through the real CLI. [Self-check](../attachments/add-existing-worktree/index.md).
