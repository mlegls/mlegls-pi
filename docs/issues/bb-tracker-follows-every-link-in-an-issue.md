---
stage: "done"
assignee: "agent:auto-routine"
priority: 2
author: "session:thr_97xxb6d8ii"
---
"an "outsider" (which every fresh context is, and which i am for issues i wasn't deeply involved in) should be able to thoroughly understand what an issue is about just by recursively following its links. this is part of the point of having it obsidian-format. so file links should be real links" (maintainer, 2026-10-25, @thread:thr_97xxb6d8ii)

The bb tracker's issue pane is where I read issues remotely, and it follows only some links: `linkify` in [app.tsx](../../bb/tracker/app.tsx) turns wikilinks to this project's issues into in-page links and renders every other wikilink (concepts, stories, attachments, guides, other projects) as plain text. Relative Markdown links to files, `[turn_clock.ts](../../packages/web/convex/lib/turn_clock.ts)`, the form the [tracker's body format](../../skills/enabled/all/mlegls/conventions/tracker/references/issue-tracker-vault.md#body) asks for, point at the plugin frame's own URL.

bb now has [Obsidian at Home](https://github.com/classicrob/obsidian-at-home) installed (plugin id `wikilinks`): a Markdown file opener with wikilinks, hover previews and backlinks. So the pane doesn't need its own note viewer; it opens the linked file in bb, and Obsidian at Home (or bb's viewer for other files) takes it from there.

## shape

```text
Detail pane Markdown (app.tsx)
  [[projects/<repo>/issues/<slug>]]         in-page, as now
  [[projects/<repo>/<path>]] other notes     → <project root>/docs/<path>.md   (projects/<repo>/ is docs/, as in issues.ts check)
  [[projects/<other>/…]]                     → that project's docs/, if bb knows the project; else plain text
  [label](relative/path)                     → resolved from the issue file's directory (docs/issues/ or docs/issues/archive/)
  http(s) links                              unchanged
  open: useBbNavigate().experimental_openFilePreview({ target, location: null })
```

Obsidian at Home builds targets as `{kind: "workspace", environmentId, path}` or `{kind: "host", hostId, path}` (its `app.tsx`); the pane is project-scoped, so it likely needs the host form with the project root's absolute path, or the project's main checkout environment. The server already knows each project's root (`p.root` in [server.ts](../../bb/tracker/server.ts)). A link whose file doesn't exist renders as plain text with a title saying so, like an unresolved wikilink. `#heading` anchors pass through as `location` if the SDK takes one, else are dropped.

## tasks

1. Resolve and open the link kinds above from the detail pane, in [app.tsx](../../bb/tracker/app.tsx) and, for anything the browser can't resolve, an rpc in [server.ts](../../bb/tracker/server.ts).
2. Update the pane's description in [README.md](../../bb/tracker/README.md), which still says it "renders the contract".
3. Rebuild with `bb plugin dev` and open, from the pane, a concept note, an attachment and a repository file linked from `docs/issues/replay-cases-first-by-default.md` in mmon/concept, which uses every kind.

## Result

The detail pane resolves wikilinks to any vault note and relative links to repository files from the issue file, and opens them in bb's file preview (Obsidian at Home renders Markdown); issue links stay in-page, unknown projects and missing files render as plain text. The resolver was checked live through its rpc; rendered clicks in the pane went unobserved because no worker browser can sign in to bb Connect (remote-bb-pane-drive-needs-authenticated-browser), so the maintainer checks them on first use. Merged by the supervisor at 2b6d8577 after review found no defect.

Evidence: [docs/attachments/bb-tracker-follows-every-link-in-an-issue/index.md](../attachments/bb-tracker-follows-every-link-in-an-issue/index.md)
