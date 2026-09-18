---
next: prototype
part-of: "[[projects/mlegls-pi/issues/home-ui]]"
---

the vault half of home: issue views that keep state across navigation, render real internal links (copy, hover, open-in-pane), and show subissue rollups and progress. the current `tracker/Tracker.base` + `tracker/Graph` datacorejsx views cannot: a datacorejsx block lives in a note's reader, so it unmounts on every navigation, and it renders its own anchors rather than obsidian's. those are datacore limits, not polish.

data stays our frontmatter (`next`, `part-of`, `blocked-by`, `claimed-by`, `priority`, later `stage`, `pool`, dates); `issues.ts` stays the model and can emit static renders (mermaid `graph LR` of the dependency network into a note) at zero cost. operon rejected as too heavy: pipeline-only kanban, time-only gantt, needs a running desktop, verified-write contract we don't need ([[projects/mlegls-pi/issues/archive/operon-adapter]]).

prototype, in order:
1. install `obsidian-bases-board` (kanban/gallery over any two properties, drag writes back) and `project-planner` (dependency graph layered by depth with critical path, per-project buckets independent of status, gantt) against the live issues. project-planner's markdown dialect (Tasks/Dataview fields) is the likely conflict; note it.
2. if neither is enough: our plugin. two shapes — own `ItemView`s (tree with rollups, board, network; full control) or Bases custom views via `registerBasesView` (Bases owns filter/sort/formula/property UI; we render). check the Bases view API surface first: what a view receives and whether it persists state. source lives here (`extensions/obsidian-tracker/`), shares the model with `issues.ts`, bun-built into the vault plugin dir.

done: the three views (tree, board, network) exist for the live tracker, whichever way, and the datacorejsx notes are retired.
