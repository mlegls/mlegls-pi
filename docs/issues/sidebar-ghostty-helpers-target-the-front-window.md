---
stage: idea
assignee: agent
author: session:01a0f6bc-8c6b-7179-b390-af3b53e964e3
---

During [[projects/mlegls-pi/issues/tree-sidebar-bridge-fixes]], an isolated Ghostty instance could not safely use the sidebar's automatic divider sizing or focus-main helper: `lib/tree/ghostty.ts` addresses `selected tab of front window` through `tell application "Ghostty"`, not the sidebar's owning surface/process. Another instance or window can own that target.

The [disposable first-use script](../attachments/tree-sidebar-bridge-fixes/first-use.sh) unsets `GHOSTTY_RESOURCES_DIR` to suppress those helpers in the isolated trial. Production helpers are unchanged; the trial does not verify their target selection. Bind the bridge to its own surface if it must work across windows/instances; the native sidebar replacement may instead remove this bridge.
