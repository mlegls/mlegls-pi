---
tags: [task]
next: implement
claimed-by: frontier/0919/augment
priority: 1
---

the first sink of [[augment]]: `comment`, end to end, everything else hardcoded. a bullet in obsidian → palette command → pi → a CriticMarkup comment appears under the bullet. this is the block→workflow→margin path the other three sinks reuse.

pieces:
1. `lib/augment.ts comment <absolute note path> <caret line>`: read the note; the block is the bullet at the caret plus its indented subtree; context is the whole note. run pi non-interactively (`pi -p` or the SDK; see skills/pi) with the grilling skill as the lens: the questions that would need answering to act on this block. re-read the note, locate the block by content, insert the answer as `{>>…<<}` lines nested one level under the bullet; fail loudly if the block moved. direct file write; obsidian picks up external changes.
2. obsidian Shell commands plugin entry (background): `bun ~/dev/mlegls-pi/lib/augment.ts comment {{file_path:absolute}} {{caret_line}}`. document the entry in the augment note's efforts; the plugin config itself lives in the vault's .obsidian.
3. Commentator plugin for rendering CriticMarkup (install note only).

skipped on purpose: routing, jev, the keymap, reply threading, propose/session/implement.

done: running the palette command on a fleeting bullet in ~/obsidian/augment.md yields a rendered comment under it within a minute; `bun test lib/augment.test.ts` covers block extraction and insertion against a fixture note.
