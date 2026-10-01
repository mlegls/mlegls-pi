---
stage: idea
assignee: agent
author: session:01a0f6bc-8c6b-7179-b390-af3b53e964e3
---

Owner: cua-driver-rs / Ghostty background launch. During [[projects/mlegls-pi/issues/tree-sidebar-bridge-fixes]], Cua 0.30.4 `launch_app` with `creates_new_application_instance:true` started Ghostty pid 47959 without stealing foreground (`self_activation_suppressed:true`). Window 17985 existed, but two `get_window_state` calls found zero AXWindows and a blank gray capture. Background Cmd-Q was refused with `off_space_or_ax_unresolved`; the owned instance was then killed through Cua. No foreground escalation was attempted.

[Capture and bounded AX observation](../attachments/tree-sidebar-bridge-fixes/index.md). The terminal process did run the sidebar. Workaround: exercise its stdin in a private pty; that cannot establish rendered Ghostty interaction. A human can reveal the owned instance before a background re-drive. It is unestablished whether Ghostty defers initialization while hidden or Cua cannot resolve its surface.
