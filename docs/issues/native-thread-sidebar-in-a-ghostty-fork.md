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
- "i only need tuis for the "main" ui that a lot of these kinds of desktop interfaces build in, bc imo the built in alternatives are worse than the best tuis." The sidebar is the only native UI; each worktree row is a Ghostty window: tabs and splits, tab 0 holding the canonical pi session.
- the sidebar view refuses first responder and accepts first mouse, so clicking a row or button acts without taking the keyboard from the terminal.
- two views, both foldable, each with its own fold state:
  - project: project → worktrees nested by merge target → the worktree's canonical session; its non-interactive workers fold under it as a roll-up (`●●○ 3 workers`), dimmed when expanded, with only open/abandon.
  - attention: interactive sessions flat, in sections needs-you → unread → read → running ("running should be the bottom bc there's nothing i can do in them"). Sections keep a stable order inside; a blocked or needs-input worker raises its interactive ancestor into needs-you. Read means shown while the window was key after the last turn ended; `seenAt` lives in the registry, not the app.
- hover shows two buttons, start ▾ and end ▾, with everything on right-click too. Start is {new, fork} × {child, sibling} worktree (click new child, ⌥ sibling, ⇧ fork); end is merge ▾ (merge & continue, abandon). Archive is left out: in the registry it is the same walk as merge.
- merge & continue lands the branch and keeps the session, "so that how long branches diverge for is separate from how long a chat context can be continuous". With rebase + fast-forward the branch tip already is the merged commit, so the session keeps going in the same directory; pi and zmx never notice.
- keys: ⌃⌘hjkl walk the current view's tree (j/k siblings, h parent, l first child, unfolding); moving shows the thread. ⌘P finds or makes threads and projects: matching threads, a child or sibling of the shown thread named by the query, each matching project (go to its latest thread, or a new thread in it), and "New project" when no project matches. ⌘O and the folder button beside the view switch do the same over projects only, plus a folder chooser. Projects are the ones with threads, then zoxide's entries that are git repos. A new project is a bare name in ~/dev or a typed path; `ab tree do new --project Q --init` creates the directory, a repo and an empty first commit as needed, since worktrees need a HEAD, and adds it to zoxide. ⇧⌘P is the command palette with every action. ⇧⌘T toggles the view, ⌃⌘S the sidebar. ⌘D / ⇧⌘D / ⌘T / ⌘W / ⌘[ ⌘] / ⌘1–9 / ⌥⌘arrows / ⌘K stay Ghostty's; In aux panes ⌘D and ⇧⌘D split as Ghostty does; in the canonical pi pane they toggle IDE-like docks, a side pane to its right and a bottom pane across the full width, which hide without killing their shells. ⌘W never closes the canonical pi pane, and no close chord reaches Ghostty from it; if Ghostty closes it anyway while the attach is alive, the app reattaches.
- aux tabs and splits are plain app processes, like Ghostty tabs: switching rows hides surfaces instead of closing them, and they die with the app. Only the canonical session is zmx-backed.
- status (working/idle/needs-input) is a colored dot fed by the registry.
- the registry is the CLI's, not the app's.

decisions:
- 2026-10-02: embed, not fork. Terminals come from [Lakr233/libghostty-spm](https://github.com/Lakr233/libghostty-spm) (MIT): GhosttyKit as a prebuilt XCFramework plus `GhosttyTerminal`, an AppKit view with `NSTextInputClient` and config loading. Ghostty's core already owns config, keybindings, fonts, renderer and shell integration, so the app is the sidebar plus whichever `action_cb` actions we handle; no rebases. The spike (`~/dev/threads-spike`) is ~170 lines: zmx sessions attach and render, `~/.config/ghostty/config` applies (font and ligatures visible), hover buttons and click-without-focus work. "i think the architecture is fundamentally sound and just needs polish".
- 2026-10-02: not GPUI over [libghostty-rs](https://github.com/uzaaft/libghostty-rs). That wraps libghostty-vt only (state, encoders), so the renderer, fonts and config would be ours: Zed's terminal design with ghostty-vt in place of alacritty_terminal. Revisit if Ghostty ships a rendering layer over libghostty-vt; a vt client could then talk to zmx's socket directly and render hover previews from terminal state.
- 2026-10-02: one live client per zmx session. zmx sizes the pty to the last client that resized, so two clients at different widths make pi's inline redraws stack into a staircase, and the misdrawn screen persists in zmx's restored state. The app detaches other clients before attaching (or shows "open elsewhere").
- 2026-10-02: interactive and non-interactive sessions are distinct kinds: a field set at spawn, not inferred. One record type (mode pty or durable, nullable owner) with the invariant that an interactive session has no owner. Non-interactive sessions (the supervision tree) are likely to move to [pi durable](https://github.com/earendil-works/pi/tree/main/packages/durable), where a worker is a conversation owned by a task and opening one would show a `viewState` transcript rather than a terminal.
- 2026-10-02: 1 worktree = 1 canonical session. "the mixing of the 2 was a big part of what i disliked about orca." Side conversations are unmanaged pi in an aux tab and need no support. Nesting in the project view then means one thing, the merge target. This is Conductor's workspace model.
- 2026-10-02: the earlier MVP (`0a3078e`, hover icons for six verbs, ⌘N/⌘D/⌘[ ⌘]/⌘1–9, a filter field, one surface closed on switch) is superseded by the shape above.
- prior art, not bases: Graftty (libghostty + zmx + worktree sidebar, ~200k lines with iOS/WebRTC), Ghostties (Ghostty fork with a sidebar, 1071 commits ahead), Calyx, Liney, Mori, Supacode, Toastty.

holes:
- toolchain: libghostty-spm's DisplayLink 3.x declares Swift tools 6.2; Xcode 16.4 has 6.1. The spike vendors both with the declared version lowered. Xcode 26 or a swiftly 6.2 toolchain removes that.
- upkeep: `ghostty.h` isn't a stable API; we ride libghostty-spm's releases.
- `resizeThrottleMilliseconds` for pi's inline redraws during live drags.
- the package points `GHOSTTY_RESOURCES_DIR` at its own bundle and loads the config by explicit path; `config-file` includes and the catppuccin theme look unchecked.
- libghostty-spm's `TerminalCallbackBridge.handleAction` forwards only title, bell, cell size, render, progress, color and URLs; `new_split`, `new_tab`, `goto_split`, `toggle_command_palette` are dropped. An upstream `onAction` hook would let the user's own Ghostty keybinds drive panes; until then the app binds those keys itself.
- splits are nested NSSplitViews (apps/threads Workspace.swift), with no zoom, equalize, resize keys or directional ⌥⌘arrows yet. Ghostty's MIT `macos/Sources/Features/Splits/SplitTree.swift` has all of that, but it's 1.4k lines that want `Codable` views and a SwiftUI host; vendor it if those features are wanted.
- the registry assumes several threads per worktree today (`ab tree do fork` forks in place); the invariant needs an audit there.
- whether the project root (main checkout) has a canonical session or is a sessionless node; leaning sessionless.
- board edges: hovering a session highlights the ones it talks to (brushing and linking), from mailbox and `run/**` traffic. Later.
- untested by hand: IME, Ghostty keybindings, scroll, selection/copy, Cmd shortcuts.
- SwiftUI `List`/`OutlineGroup` vs `NSOutlineView` for the sidebar (drag/drop and hover fidelity).
- how the app hears about registry changes: polling the CLI, or watching files.
