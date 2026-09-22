---
stage: spec
assignee: human
part-of: "[[projects/mlegls-pi/issues/home-ui]]"
---

the vault half of home: issue views that keep state across navigation, render real internal links (copy, hover, open-in-pane), and show subissue rollups and progress. the current `tracker/Tracker.base` + `tracker/Graph` datacorejsx views cannot: a datacorejsx block lives in a note's reader, so it unmounts on every navigation, and it renders its own anchors rather than obsidian's. those are datacore limits, not polish.

data stays our frontmatter (`stage`, `assignee`, `author`, `part-of`, `blocked-by`, `claimed-by`, local `priority`); `issues.ts snapshot --json` supplies the current recursive model. Any replacement must preserve its frontier/mine/done semantics and can emit static renders (mermaid `graph LR` of the dependency network into a note) at zero cost. operon rejected as too heavy: pipeline-only kanban, time-only gantt, needs a running desktop, verified-write contract we don't need ([[projects/mlegls-pi/issues/archive/operon-adapter]]).

shape: `extensions/obsidian-tracker/` — `model.ts` (vault-wide readiness, pure over `{path, frontmatter}`; `lib/tracker-views.test.ts` holds it at parity with the CLI), `view.ts` (a Bases view type `tracker`), `bun run build.ts [--watch]`, `dist/` symlinked as `~/obsidian/.obsidian/plugins/tracker`. `registerBasesView` chosen over own `ItemView`s: Bases owns filter/sort/group/property UI and persists view options in the `.base` file; the view computes readiness over every issue note in the vault (`metadataCache`) and uses the Base's entries only as the visible set, so rollups survive filtering. mode (tree/frontier/mine/done/invalid/legacy/all), show done and include deferred are view options; tree collapse state persists as `toggled`. links are `internal-link` anchors with hover-link and file-menu.

holes:
- graph view (`tracker-graph`, port of `tracker/Graph`'s force layout to SVG in the same factory) and board.
- retire `tracker/Tracker.md`, `lib.md`, `Graph.md` and datacore once the graph exists.
- `issues.ts` still has its own slug-keyed model; it could import `model.ts` the way it imports `lib/tracker-lint.ts`. parity test is the seam until then.
- collapse toggles write the `.base` on every click; move to plugin `saveData` if that proves noisy.

decisions:
- 2026-09-22: Bases custom views, not ItemViews. project-planner tried earlier and reverted (hard-coded board groupings, own task model).

done: the three views (tree, board, network) exist for the live tracker, whichever way, and the datacorejsx notes are retired.
