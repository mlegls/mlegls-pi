---
name: attention
description: "Read this before repeating something the user hasn't responded to from a previous turn."
---

whatever needs me (a decision, a check, a credential, an action) and has gone unanswered goes in `desk/ATTENTION.md`, so it isn't restated at the end of every turn. this comes up in sessions that wake while i'm away: worker or reconciler mail, process notifications, peer messages, an automation re-prompting the same thread.

one `## ` item each, readable cold. say what it's about in plain words, the question, the options with your recommendation, what waits on it, and your `@thread:…`.

write through `ab desk attention add TITLE --file PATH|-` and `ab desk attention remove TITLE` (`ab desk --help`); they use `BB_THREAD_ID` or `--thread ID`. delete your item once it's answered or moot. the file is the only list: anything you'd tell me is waiting goes in it first. in chat, don't list or summarize unanswered items, even citing the file; mention an item only in the turn you add, change or remove it.

> No: "Still waiting on you:\n- **Drawings:** three are waiting for a look.\n- **Problem-title commit:** should I file `30a71d449`'s rename-on-read…?"
> Yes: "Added to [desk/ATTENTION.md](desk/ATTENTION.md): whether to file `30a71d449`'s rename-on-read for review." Next turn: nothing.

before archiving the asking thread, re-file its still-needed items under a live thread.
