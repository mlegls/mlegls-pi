---
stage: "goal"
assignee: "agent"
priority: 2
author: "session:thr_97xxb6d8ii"
---
"an "outsider" (which every fresh context is, and which i am for issues i wasn't deeply involved in) should be able to thoroughly understand what an issue is about just by recursively following its links. this is part of the point of having it obsidian-format. so file links should be real links" (maintainer, 2026-10-25, @thread:thr_97xxb6d8ii)

The bb tracker's detail pane is where I read issues remotely, and it can't follow most links: `linkify` in [app.tsx](../../bb/tracker/app.tsx) turns wikilinks to this vault's issues into in-page links and renders every other wikilink (concepts, stories, attachments, guides) as plain text. Relative links to repository files (`[turn_clock.ts](../../packages/web/convex/lib/turn_clock.ts)`, the form the [tracker body format](../../skills/enabled/all/mlegls/conventions/tracker/references/issue-tracker-vault.md#body) now asks for) go to the plugin frame's own URL.

So: vault notes open in the pane the way issues do (read through the plugin's server like the `issue` rpc, with a back link), and repository files open in bb's file view, if the plugin SDK can navigate there (`useBbNavigate`), or as a read-only view in the pane otherwise.
