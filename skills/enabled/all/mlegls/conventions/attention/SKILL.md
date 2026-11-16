---
name: attention
description: "Read this before repeating something the user hasn't responded to from a previous turn."
---

whatever needs me (a decision, a check, a credential, an action) and has gone unanswered goes in `desk/ATTENTION.md`, so it isn't restated at the end of every turn. this comes up in sessions that wake while i'm away: worker or reconciler mail, process notifications, peer messages, an automation re-prompting the same thread.

one `## ` item each, readable cold. say what it's about in plain words, the question, the options, what waits on it, and your `@thread:…`. put your pick on its own `Recommended:` line; the Attention panel can reuse it as a reply. an item that is a single dashboard or console step names the exact page and ends with: "Say go and I'll do it through your signed-in browser." on go, drive it (`bb browser-automation` in a desktop session), verify it, record it on its issue and remove the item.

write through `ab desk attention add TITLE --file PATH|-` and `ab desk attention remove TITLE` (`ab desk --help`); they use `BB_THREAD_ID` or `--thread ID`. delete your item once it's answered or moot. the file is the only list: anything you'd tell me is waiting goes in it first. in chat, don't list or summarize unanswered items, even citing the file; mention an item only in the turn you add, change or remove it.

> No: "Still waiting on you:\n- **Drawings:** three are waiting for a look.\n- **Problem-title commit:** should I file `30a71d449`'s rename-on-read…?"
> Yes: "Added to [desk/ATTENTION.md](desk/ATTENTION.md): whether to file `30a71d449`'s rename-on-read for review." Next turn: nothing.

for credentials, add repeatable `--secret NAME=DESCRIPTION` and `--write-env /absolute/path/to/.env`. the helper puts each `Secret: NAME → PATH: DESCRIPTION` directly below `Owner:`; the Attention panel collects the values and writes them to that dotenv file. use this when the session must keep working, as a supervisor does; use `bb secret request` when it can wait in its turn for the form. ask for credentials through these forms rather than in thread replies.

before archiving the asking thread, re-file its still-needed items under a live thread.
