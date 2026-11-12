---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:01a1cdb9-2d1f-77a1-9159-fc3a2fecd605"
priority: 2
---
The maintainer reads and answers every project's `desk/ATTENTION.md` items in bb, in a third page of the [tracker plugin](../../../bb-plugins/tracker/README.md). For [[projects/mlegls-pi/stories/answer-what-agents-ask-of-me]]: "a convenient way to see it per project, annotate there and send to the relevant agents" (maintainer, 2026-11-12, @thread:thr_ywttjvanqg).

A panel in tracker and not its own plugin, because tracker already resolves each project's main checkout, watches files and publishes changes, and links threads; the desk's other two files already show there (the role holder in the Supervise dialog, reconcilers in Campaigns). Bb's marketplace inboxes (Needs You, Feed, Herald, Focus Board) list threads by pending interaction or unread turn, one row per thread; attention items are several per thread and outlive turns. Notification on a new item is [[projects/mlegls-pi/issues/a-new-attention-item-notifies-the-maintainer]].

## shape

### the item format, in this repository

- [desk.ts](../../lib/desk.ts): `desk attention add` takes `--secret NAME=DESCRIPTION` (repeatable) with `--write-env PATH` (absolute, required with `--secret`), and writes under the item's `Owner:` line one `Secret: NAME → PATH: DESCRIPTION` line per variable. Nothing else about the item changes, so the file still reads plainly without the panel.
- The attention skill and the [desk guide](../guide/desk.md): an item that offers options puts its pick on its own line starting `Recommended:`; a credential the maintainer must supply is asked for with `--secret`, never as "paste it in the thread". Bb's `bb secret request` stays the way to ask when the session can wait in its turn; it parks the turn until the form is submitted, which a supervisor can't afford.

### the panel, in `~/dev/bb-plugins/tracker`

- [server.ts](../../../bb-plugins/tracker/server.ts): an `attention` RPC returns, for every project `bb.sdk.projects.list()` gives, the items parsed from `<main checkout>/desk/ATTENTION.md`: title, owner thread (the `Owner: @thread:` line), secret lines, body, and the owner's title and status from `bb.sdk.threads`. Each project's `desk/` is watched as `docs/issues` is, publishing a change event. The files stay the only list: the plugin never writes them, and an item leaves when its agent runs `ab desk attention remove`.
- `reply` RPC: takes `{ project, owner, title, text, secrets? }[]`, groups by owner, and sends each owner one message through `bb.sdk.threads.send` with `mode: "queue-if-active"` (as Supervise's send does): per item, its title as a heading and the maintainer's text under it. It records each sent item as answered in plugin storage, keyed by project, owner, title and a hash of the item's body, so an item the agent rewrote reads as unanswered again and entries for items gone from the file are dropped on read.
- Secrets: for each `{ name, value }` the server sets that assignment in the item's dotenv file (replacing an existing assignment of the name in place, appending otherwise, creating the file at mode 0600), then adds to that item's part of the message "Wrote NAME to PATH". The name and path come from the item as parsed from the file at send time, never from the request. A value exists only in the input, the RPC call and the dotenv file: it is not in drafts, the answered record, the message, logs or an error text. A failed write sends nothing for that item and shows the error on it.
- [app.tsx](../../../bb-plugins/tracker/app.tsx): `navPanel` "Attention" with `experimental_useBadge` returning the count of unanswered items across projects. Items grouped by project, each rendered as Markdown with its owner as a thread chip that opens the thread, a reply box, and "Take the recommendation" when the item has a `Recommended:` line (fills the reply with it, still editable). Selecting text in an item and pressing Quote inserts it into that item's reply as `> ` lines. An item with secret lines shows, above the reply box, one password input per variable labelled with its name and description, and the destination path in full. Drafts of reply text persist per item until sent. One Send for all items with a reply or a filled secret; answered items collapse to their title with what was sent ("Wrote NAME to PATH" for secrets).

Out: editing or removing items from the page; roles and `STATUS.md`; passage-anchored comments; secrets anywhere but a dotenv file.

First use: in a disposable project, an agent thread files one item with options and a `Recommended:` line and one with `--secret`; from the panel, quote a passage and reply to the first, paste a value into the second, Send. The thread receives one message naming both items without the value, the dotenv file holds the assignment, the badge drops by two, and both items leave when the thread removes them.

decisions:
- 2026-11-12: a tracker panel, not a separate plugin; one inbox grouped by project; a reply box per item with `>` quotes for passages (maintainer, @thread:thr_ywttjvanqg).
- 2026-11-12: the screen as mocked in @thread:thr_ywttjvanqg is approved ("nice, this looks good"), with secret inputs added: "for \"key expired\" i can just paste in the key" (maintainer).

## tasks

Implementation is partitioned into [[projects/mlegls-pi/issues/desk-attention-items-carry-secret-requests-and-recommendations]] and [[projects/mlegls-pi/issues/tracker-attention-panel-answers-project-desks]]. They can proceed independently against the item format above; the plugin child owns its backend/UI RPC interface together.

After both children reach their target checkouts, carry out the combined first use above in a disposable bb project using the changed desk helper and built tracker plugin. Record the rendered panel, the single grouped owner message without the credential value, the dotenv assignment, answered badge changes and item removal. Update the [desk guide](../guide/desk.md) and [tracker README](../../../bb-plugins/tracker/README.md) with the verified entry points. The plugin child's handoff supplies its deployment and restore steps.

The plugin child works in its own `bb-plugins` worktree from `main` and declares its foreign checkout and commits in the handoff. Supervisor @thread:thr_dfgkcug6jp owns merging those commits into `/home/mlegls/dev/bb-plugins` main when completion holds, then removing the foreign worktree; the unrelated modified `obsidian-at-home` submodule remains untouched (approved by that supervisor, 2026-11-12).
