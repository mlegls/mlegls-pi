---
stage: "idea"
author: "session:thr_ajm92xfycx"
---
A bb notification clicked in macOS Notification Center only dismisses; it doesn't open its thread. Seen on the maintainer's Mac with a notification sent by `bb push-notifications send --thread thr_caanfj9khu` ([[projects/mlegls-pi/issues/a-new-attention-item-notifies-the-maintainer]], first use, 2026-11-12): "Clicking a notification in macOS Notification Center merely dismissed it and opened nothing" (drive packet, relayed by @thread:thr_dfgkcug6jp). Owner: bb itself (desktop shell / push-notifications plugin, bb 0.48.1), not this repository.

## observations

- Server side is right: `bb push-notifications send` resolves the thread and publishes `{id, title, body, threadId, channels}` to web and desktop clients, and sends Expo data `{projectId, threadId}` to mobile; the same `deliver` path serves bb's own thread notifications. Read from `app-versions/0.48.1/.../builtin-plugins/push-notifications/dist/server.js`.
- Client side (`dist/app.js`): web and desktop clients show `new Notification(title, {body, tag: "bb-<threadId>"})` and wire `onclick` to `window.focus()`, `bbDesktop.focusWindow()` and `navigation.toThread(threadId)`. The handler exists and targets the thread; the click never reached it, or the notification had already been closed (`onclose` deletes it from the live set).
- Not established: whether bb's own turn-finished notifications also fail the same way on that Mac, whether the click was on a banner or an entry in Notification Center after the banner expired, and whether the notification came from the desktop app or a browser tab. The packet recorded none of these.

## to find out

1. On the Mac, click the banner while it is still showing, then an entry after it has moved into Notification Center, for a bb turn-finished notification and for a `send --thread` one.
2. If only the Notification Center click fails for both, it is a bb desktop shell limitation (a renderer `Notification` loses its `onclick` once the banner expires, or the app is not activated); report to bb.

