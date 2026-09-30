# Tracker Bases first-use drive

## Predictions before opening the product

Source: ticket and `extensions/obsidian-tracker/FIRST-USE.md` only. Persona: new user of a disposable desktop Obsidian vault, no credentials.

- **First use:** Opening `/tmp/tracker-obsidian-views-clean/Tracker.base` should show a functioning Base with saved Tree, Board, Network and six legacy modes after plugin trust. I should be able to switch views without configuration.
- **Tree:** Parent, open/done children, external blocker and isolated issue should be visible according to Base entries. A parent should show its own stage, subtree stage, and 1/2 subissue completion even if a child is filtered. Clicking collapse should hide descendants; switching view or navigating away/back should retain collapse. Clicking a link should open its issue, command-hover should preview, and context menu should offer copy/open-in-pane/file operations.
- **Board:** Columns should reflect arbitrary `lane` grouping, not workflow stages; cards should sort by descending filename. Filtered Board should show only parent while retaining 1/2 completion and external blocker. Card links should expose the same native operations and hover as Tree; no stage-change drag/drop expected.
- **Network:** Connected parent/children and isolated issue should be presented, isolated node labeled on hover. Clicking opens issues, command-hover previews, context menu offers native link/file operations. Dragging a node pins it; navigation away/back retains the pin; double-click unpins without opening the issue.
- **Other modes:** Frontier, Mine, Done, Invalid, Legacy and All should remain selectable and render appropriate entries rather than unknown-view errors.

## Setup and encounter

Pending.
