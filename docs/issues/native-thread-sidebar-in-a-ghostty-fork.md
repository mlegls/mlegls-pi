---
stage: goal
assignee: human
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]]"
blocked-by: ["[[projects/mlegls-pi/issues/check-zmx-reattach-with-pi]]", "[[projects/mlegls-pi/issues/thread-registry-on-zmx]]"]
priority: 2
---

Fork Ghostty's macOS app (MIT) and add a native sidebar showing the two thread trees from [[projects/mlegls-pi/issues/thread-registry-on-zmx]], with a main area that is only terminals. Hover, buttons, and "clicking here doesn't take keyboard focus" are basic AppKit features that a TUI sidebar can only imitate.

shape:
- the sidebar view refuses first responder and accepts first mouse, so clicking a row or button acts without taking the keyboard from the terminal. Sidebar actions get their own keybindings; there's no sidebar focus to manage.
- archive/merge/abandon/new appear on hover over the row, like Xcode, Finder or Linear, with a right-click menu too. Project rows get a "+" for "new thread here / in a new worktree".
- scroll is just scroll. Hover can show a preview (last board report, or a live thumbnail of the zmx session); only a click opens.
- drag to reparent in the merge-order view writes the merge-order overrides.
- status (working/idle/needs-input) is a colored dot fed by the registry.
- the main area shows the selected thread's surfaces, each running `zmx attach <thread>.<role>`. Offscreen surfaces close and reattach on view: [[projects/mlegls-pi/issues/check-zmx-reattach-with-pi]] found pi and nvim reattach byte-identical, so no LRU.
- the change is mostly additive inside Ghostty's `macos/` (new sidebar, native tabs removed), which keeps rebase conflicts with upstream small. The registry is the CLI's, not the app's.

holes:
- build and upkeep: the zig xcframework build, and GhosttyKit's API changing without notice.
- SwiftUI `List`/`OutlineGroup` vs `NSOutlineView` for the sidebar (drag/drop and hover fidelity).
- how the app hears about registry changes: polling the CLI, or watching files.
