---
stage: ticket
assignee: agent
priority: 1
author: "session:ca48dc62"
---

Observed 2026-10-17 in Common Concept (`bring-the-application-to-the-main-pages-design`): the parent's implement phase returned `done` as a refinement (commit `496d9830`) that filed five agent-ready child tickets (`use-the-canvas-document-columns-across-main-pages` and four siblings, each `part-of` the parent). The reconciler did not schedule the children; it launched the parent's drive (`…-drive-17`), which found no stories. Restarting the reconciler (reconcile_stop + reconcile) picked the children up correctly.

Two related losses on that path:
- the refinement commit `496d9830` (real code: page-frame.tsx, framing, ink actions) never reached the parent's collector (`tree/bring-the-application-to-the-main-pages-design`); a later child had to cherry-pick it.
- after a later child (`compare-the-remaining-main-page-frames-on-desktop-and-phone`) was moved out by a handler, the parent "resumed drive from the stopped run's branch …-drive-17 at 73121668", a stale base lacking every child landed since.

Done when: a refinement that creates children (a) lands its own commits into the collector, (b) is followed by scheduling those children before any parent drive, and (c) a parent resuming after a move-out starts from the collector head, not a stopped run's kept branch — each shown on a scripted reconcile scenario.
