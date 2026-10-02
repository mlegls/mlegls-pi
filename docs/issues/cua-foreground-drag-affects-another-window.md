---
stage: idea
author: session:2cb077eb-f13b-4989-96c6-789614fd47f3
---

While self-checking sibling reordering in [[projects/mlegls-pi/stories/work-in-threads]], foreground Cua drags targeted the checkout-owned fixture window (PID 91622, window 22209), but its screenshot and saved order stayed unchanged. The user reported: "it seems the drag is doing it in my foregrounded window. i tried in the background window and it seems to work though".

Calls used `mcp__cua__drag` with `target: {kind: "window", pid: 91622, window_id: 22209}`, `delivery_mode: "foreground"`, window-local coordinates and session `sibling-order`. Cua reported posted foreground HID events with `effect: unverifiable`. The exact input recipient is not established; the user's observation suggests foreground routing escaped the specified window. GUI input stopped, and the owned fixture process was terminated.

Owner: cua-driver foreground window routing. Investigate exact-target activation and event delivery before using this route with another Threads window open.
