---
stage: "ticket"
assignee: "agent"
author: "session:01a1cdb9-2d1f-77a1-9159-fc3a2fecd605"
priority: 2
---
A new item in `desk/ATTENTION.md` sends a system notification, so the maintainer hears about it without opening the file. For [[projects/mlegls-pi/stories/answer-what-agents-ask-of-me]]: "and have system notifications" (maintainer, 2026-11-12, @thread:thr_ywttjvanqg).

## shape

`addAttention` in [desk.ts](../../lib/desk.ts), after the desk write succeeds, sends through bb's push-notifications plugin (`bb push-notifications send --title … --body … --thread <owner>`, or its `notifications.send` RPC; see `bb push-notifications send --help`). The click opens the owning thread.

- Title: the project (the main checkout's directory name) and the item's title; bb cuts it at 80 characters. Body: the item's first paragraph; bb cuts it at 180.
- Only when the item is new or its body changed. An owner re-adding the same title with the same body, `ab desk clean` and `handoverDesk` send nothing.
- A failed or undelivered send (plugin disabled, no channel reached) is one line on stderr; the desk write stands and the command exits 0.
- [desk guide](../guide/desk.md) says an add notifies, and that web and desktop banners need an open bb tab or window while mobile doesn't.

First use: in the guide's disposable fixture, `desk attention add` twice with the same body and once with a changed one; two notifications arrive on the maintainer's devices. This pings the maintainer, so do it once, with a title that says it's a test.
