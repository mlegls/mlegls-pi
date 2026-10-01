---
stage: idea
assignee: agent
author: session:01a0f7df-1138-76f0-8476-747adc5e73d9
---

Owner: cua-driver-rs. During [[projects/mlegls-pi/stories/work-in-threads]], background pixel clicks aimed at the child row in owned Ghostty window 19231 instead toggled the sidebar's tree heading. The screenshots reported a 1512×944 window and scale 2, with default PNG 1568×979. Retrying from a fresh `max_image_dimension:0` capture (3024×1888) at a child-row coordinate still toggled the heading. No foreground escalation was attempted. Earlier background clicks in owned window 19112 did attach its child and grandchild.

The coordinate-conversion cause is not established. Workaround for final implementation re-drive: call the same frontend action API with the owned window's tracked token, then observe its actual main pane and zmx inventory. The independent driver should use fresh native snapshots and distinguish a delivered click from the requested row selection. [Evidence](../attachments/tree-sidebar-over-threads/index.md).

Independent drive reproduced the heading toggle in window 19291 at PNG `(90,71)` (1568×979). Scoped foreground click plus foreground `j`/Enter eventually selected and showed the child; later scoped Tab and `n` failed `exact target window did not become focused for foreground HID delivery`. Reopening as window 19322 did not recover: `n` with sidebar pixel focus failed `focus pixel-click at (90,55) failed`. Background keyboard correctly refused `same_pid_keyboard_ambiguity`. AX close/confirmation worked for cleanup. Observation only: no coordinate or focus cause established; no API workaround used for independent acceptance. [Independent packet](../attachments/tree-sidebar-over-threads/independent-drive.md) records input routes and the remaining lifecycle observations.
