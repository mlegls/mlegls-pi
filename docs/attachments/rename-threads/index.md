# Custom thread names

Starting ref: `9a315e6`. Display names belong to Threads' saved UI state, keyed by thread ID. They do not rename branches, worktrees or worker handles, and are not exposed by `ab thread ls`.

`swift build --package-path apps/threads` passes. There is no Swift test target. A temporary diagnostic compiled the production `Registry.swift` and the extracted `Controller.setThreadName` method with a controller shell (stubbed rebuild/window). It checked rename/reset, Unicode and whitespace trimming, finding both custom and default names, worker and project-thread labels, preserving identity/parentage/order/shown thread, backward decoding and save/load replay. This is a state/helper check, not native GUI acceptance.

Intended first use: right-click a thread → Rename… → enter a name → Save. Thread → Rename… and the command palette act on the shown thread. Blank input restores the default; Cancel leaves it unchanged. Check both views, ⌘P search, the shown window title and a restart with the same state file.

No native input was attempted because the previous fixture run affected the user's foreground window: [[projects/mlegls-pi/issues/cua-foreground-drag-affects-another-window]]. Sheet interaction, Cancel and native restart replay remain unobserved; their owner is [[projects/mlegls-pi/issues/native-thread-sidebar-in-a-ghostty-fork]]. The implementation can be tried with `swift build --package-path apps/threads`, then `AB_BIN="$PWD/bin/ab" THREADS_STATE=/tmp/threads-rename-check.json apps/threads/.build/debug/Threads`; this uses the real registry with isolated UI state.

Story: [[projects/mlegls-pi/stories/work-in-threads]].
