---
stage: "goal"
assignee: "agent"
author: "session:01a1cdb9-2d1f-77a1-9159-fc3a2fecd605"
priority: 2
---
The maintainer reads and answers every project's `desk/ATTENTION.md` items in bb, in a third page of the [tracker plugin](../../../bb-plugins/tracker/README.md). For [[projects/mlegls-pi/stories/answer-what-agents-ask-of-me]]: "a convenient way to see it per project, annotate there and send to the relevant agents" (maintainer, 2026-11-12, @thread:thr_ywttjvanqg).

A panel in tracker and not its own plugin, because tracker already resolves each project's main checkout, watches files and publishes changes, and links threads; the desk's other two files already show there (the role holder in the Supervise dialog, reconcilers in Campaigns). Bb's marketplace inboxes (Needs You, Feed, Herald, Focus Board) list threads by pending interaction or unread turn, one row per thread; attention items are several per thread and outlive turns. Notification on a new item is [[projects/mlegls-pi/issues/a-new-attention-item-notifies-the-maintainer]].

holes:
- the screen, approved by the maintainer before this is a spec ([[projects/mlegls-pi/stories/prototype-ux-while-shaping]]).

## shape

In `~/dev/bb-plugins/tracker`:

- [server.ts](../../../bb-plugins/tracker/server.ts): an `attention` RPC returns, for every project `bb.sdk.projects.list()` gives, the items parsed from `<main checkout>/desk/ATTENTION.md`: title, owner thread (the `Owner: @thread:` line `addAttention` in [desk.ts](../../lib/desk.ts) writes), body, and the owner's title and status from `bb.sdk.threads`. Each project's `desk/` is watched as `docs/issues` is, publishing a change event. The files stay the only list: the plugin never writes them, and an item leaves when its agent runs `ab desk attention remove`.
- `reply` RPC: takes `{ project, owner, title, text }[]`, groups by owner, and sends each owner one message through `bb.sdk.threads.send` with `mode: "queue-if-active"` (as Supervise's send does): per item, its title as a heading and the maintainer's text under it. It records each sent item as answered in plugin storage, keyed by project, owner, title and a hash of the item's body, so an item the agent rewrote reads as unanswered again and entries for items gone from the file are dropped on read.
- [app.tsx](../../../bb-plugins/tracker/app.tsx): `navPanel` "Attention" with `experimental_useBadge` returning the count of unanswered items across projects. Items grouped by project, each rendered as Markdown with its owner as a thread chip that opens the thread, a reply box, and "Take the recommendation" (fills the reply with that sentence, still editable). Selecting text in an item and pressing Quote inserts it into that item's reply as `> ` lines. Drafts persist per item until sent. One Send for all drafted replies; answered items collapse to their title with what was sent.

Out: editing or removing items from the page; roles and `STATUS.md`; passage-anchored comments.

decisions:
- 2026-11-12: a tracker panel, not a separate plugin; one inbox grouped by project; a reply box per item with `>` quotes for passages (maintainer, @thread:thr_ywttjvanqg).
