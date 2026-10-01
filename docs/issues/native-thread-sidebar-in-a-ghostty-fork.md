---
stage: goal
assignee: human
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]]"
blocked-by: ["[[projects/mlegls-pi/issues/check-zmx-reattach-with-pi]]", "[[projects/mlegls-pi/issues/thread-registry-on-zmx]]"]
priority: 2
---

A native macOS app embedding libghostty, with a sidebar showing the two thread trees from [[projects/mlegls-pi/issues/thread-registry-on-zmx]], with a main area that is only terminals. Hover, buttons, and "clicking here doesn't take keyboard focus" are basic AppKit features that a TUI sidebar can only imitate.

shape:
- the sidebar view refuses first responder and accepts first mouse, so clicking a row or button acts without taking the keyboard from the terminal. Sidebar actions get their own keybindings; there's no sidebar focus to manage.
- archive/merge/abandon/new appear on hover over the row, like Xcode, Finder or Linear, with a right-click menu too. Project rows get a "+" for "new thread here / in a new worktree".
- scroll is just scroll. Hover can show a preview (last board report, or a live thumbnail of the zmx session); only a click opens.
- drag to reparent in the merge-order view writes the merge-order overrides.
- status (working/idle/needs-input) is a colored dot fed by the registry.
- the main area shows the selected thread's surfaces, each running `zmx attach <thread>.<role>`. Offscreen surfaces close and reattach on view: [[projects/mlegls-pi/issues/check-zmx-reattach-with-pi]] found pi and nvim reattach byte-identical, so no LRU.
- the registry is the CLI's, not the app's.

decisions:
- 2026-10-02: embed, not fork. Terminals come from [Lakr233/libghostty-spm](https://github.com/Lakr233/libghostty-spm) (MIT): GhosttyKit as a prebuilt XCFramework plus `GhosttyTerminal`, an AppKit view with `NSTextInputClient` and config loading. Ghostty's core already owns config, keybindings, fonts, renderer and shell integration, so the app is the sidebar plus whichever `action_cb` actions we handle; no rebases. The spike (`~/dev/threads-spike`) is ~170 lines: zmx sessions attach and render, `~/.config/ghostty/config` applies (font and ligatures visible), hover buttons and click-without-focus work. "i think the architecture is fundamentally sound and just needs polish".
- 2026-10-02: not GPUI over [libghostty-rs](https://github.com/uzaaft/libghostty-rs). That wraps libghostty-vt only (state, encoders), so the renderer, fonts and config would be ours: Zed's terminal design with ghostty-vt in place of alacritty_terminal. Revisit if Ghostty ships a rendering layer over libghostty-vt; a vt client could then talk to zmx's socket directly and render hover previews from terminal state.
- 2026-10-02: one live client per zmx session. zmx sizes the pty to the last client that resized, so two clients at different widths make pi's inline redraws stack into a staircase, and the misdrawn screen persists in zmx's restored state. The app detaches other clients before attaching (or shows "open elsewhere").
- prior art, not bases: Graftty (libghostty + zmx + worktree sidebar, ~200k lines with iOS/WebRTC), Ghostties (Ghostty fork with a sidebar, 1071 commits ahead), Calyx, Liney, Mori, Supacode, Toastty.

holes:
- toolchain: libghostty-spm's DisplayLink 3.x declares Swift tools 6.2; Xcode 16.4 has 6.1. The spike vendors both with the declared version lowered. Xcode 26 or a swiftly 6.2 toolchain removes that.
- upkeep: `ghostty.h` isn't a stable API; we ride libghostty-spm's releases.
- `resizeThrottleMilliseconds` for pi's inline redraws during live drags.
- the package points `GHOSTTY_RESOURCES_DIR` at its own bundle and loads the config by explicit path; `config-file` includes and the catppuccin theme look unchecked.
- untested by hand: IME, Ghostty keybindings, scroll, selection/copy, Cmd shortcuts.
- SwiftUI `List`/`OutlineGroup` vs `NSOutlineView` for the sidebar (drag/drop and hover fidelity).
- how the app hears about registry changes: polling the CLI, or watching files.
