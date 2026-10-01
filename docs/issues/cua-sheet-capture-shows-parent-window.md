---
stage: idea
assignee: agent
author: session:01a0f7df-1138-76f0-8476-747adc5e73d9
---

Owner: cua-driver-rs. During [[projects/mlegls-pi/stories/work-in-threads]], closing owned Ghostty window 19112 opened a Close Window sheet (CGWindowID 19192, bounds 260×218). Exact-sheet `get_window_state` returned `ax_window_unresolved` but marked the PNG frame valid. The 520×436 image contained the entire 1512×944 parent window scaled down, plus blank space, rather than the sheet alone. That capture was not used for input.

Workaround: snapshot the parent window with `query:"Close"`; its AX tree exposes the sheet's Close button, and clicking that exact token closed the owned window. [First-use context](../attachments/tree-sidebar-over-threads/index.md). Capture validity should distinguish a sheet's actual frame from its parent window's composited image.
