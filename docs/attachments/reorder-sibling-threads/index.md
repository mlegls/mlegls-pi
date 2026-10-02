# Sibling thread reordering

Implementation: `fe80f56`. `swift build --package-path apps/threads` passes. The Swift app has no existing test target.

The native self-check used an isolated `AB_BIN` returning fixture registry rows and a private `THREADS_STATE` file; it did not manipulate real thread parentage. Before the stable-identity correction, dragging Gamma before Alpha changed the project's saved order to `c,a,b`; dragging Alpha one downward changed its sibling group to `a2,a1,w1,w2`. Dropping Gamma onto Alpha one left the order unchanged. Attention-view dragging stored a separate order, exposing project-header node keys in the saved thread list.

The correction uses thread IDs for ordering even when a project thread reuses its header node. A temporary Swift diagnostic compiled the final `Registry.swift` and `Sidebar.swift`: reused and fresh attention nodes had the same ordering key, older state without thread ordering decoded successfully, and both views' orders survived saving and loading from disk.

Final native confirmation came from the user: "i tried in the background window and it seems to work though". Further automated GUI driving stopped when the user observed input in their foreground window rather than the targeted fixture: [[projects/mlegls-pi/issues/cua-foreground-drag-affects-another-window]]. No screenshot is presented as evidence of final automated acceptance. Full native restart/new-sibling replay was not completed; broader native verification remains with [[projects/mlegls-pi/issues/native-thread-sidebar-in-a-ghostty-fork]]. This is a standalone implementation self-check, not independent acceptance.

To try the change without replacing the installed app:

```sh
swift build --package-path apps/threads
AB_BIN="$PWD/bin/ab" THREADS_STATE=/tmp/threads-reorder-check.json apps/threads/.build/debug/Threads
```

This uses the real registry but a separate sidebar-state file. Drag sibling rows in project and attention views, switch views, restart with the same state path, and check that a new sibling follows the arranged ones. Parent changes must be rejected; the open terminal must not switch during a drag.
