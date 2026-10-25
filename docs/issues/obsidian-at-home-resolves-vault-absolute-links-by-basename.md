---
stage: "idea"
priority: 3
author: "session:thr_97xxb6d8ii"
---
[Obsidian at Home](https://github.com/classicrob/obsidian-at-home), bb's Markdown opener, resolves a wikilink relative to the note, then from the workspace root, then by basename, picking the shallowest file of that name (`resolveWikilinkPath` in its `wikilinks.ts`). Our links are vault-absolute, `[[projects/<repo>/…]]`, where `projects/<repo>/` is the repository's `docs/` (the [tracker format](../../skills/enabled/all/mlegls/conventions/tracker/references/issue-tracker-vault.md)). Neither of the first two steps knows that, so every such link resolves by basename: right for issues and concepts, whose names are unique, wrong for attachments, which are mostly `<packet>/index.md` (`[[projects/concept/attachments/chosen-practice-first-use/index]]` opens whichever `index.md` is shallowest). Following links onward from a note opened in bb then goes astray.

Two ways out: upstream, resolve by the longest matching path suffix before falling back to the bare basename (what Obsidian does in effect, and generally useful); or a plugin setting mapping a link prefix to a directory (`projects/concept` → `docs`). The first needs no configuration and fixes it for any vault mounted under a prefix.
