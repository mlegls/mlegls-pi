---
name: attention
description: "Read this before repeating something the user hasn't responded to from a previous turn."
---

whatever needs me (a decision, a check, a credential, an action) and has gone unanswered goes in `desk/ATTENTION.md`, so it isn't restated at the end of every turn. this comes up in sessions that wake while i'm away: worker or reconciler mail, process notifications, peer messages, an automation re-prompting the same thread.

one `## ` item each, readable cold. say what it's about in plain words, the question, the options with your recommendation, what waits on it, and your `@thread:…`.

write through `ab desk attention add TITLE --file PATH|-` and `ab desk attention remove TITLE` (`ab desk --help`); they use `BB_THREAD_ID` or `--thread ID`. delete your item once it's answered or moot. in chat, point to the file instead of restating items i haven't answered. before archiving the asking thread, re-file its still-needed items under a live thread.
