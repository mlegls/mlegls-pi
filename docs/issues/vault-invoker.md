---
tags: [task]
next: implement
claimed-by: frontier/0919/vault
priority: 1
---

the bridge described in the vault note [[directing work from obsidian]]: a pi skill I invoke in a session after editing notes, which finds supertagged blocks and acts on them per [[workflows]], writing results back into the notes. until obsidian triggers it directly, this is the whole "control plane"; the invoker is the part that later becomes a palette command or watcher, so keep it a library call with a thin skill.

- `lib/vault.ts`: `changed()` = notes under ~/obsidian (root only, not project symlinks) modified since a stamp file; `blocks(note)` = supertagged bullets with their subtree, plus the thread state: the last {>>…<<} under a bullet, and whether it's the user's (plain) or a model's (prefixed `name: `). `act(block)` per tag; `writeBack` inserts comments nested under the bullet or replaces the bullet per the tag's rule, guarded by content match like lib/augment.ts.
- tags and their rules are read from workflows.md's tag list at call time (the `- #tag - what to do` bullets); the code knows only the syntax and the write-back forms. handle now: #question (lens comment; a lens parameter in the bullet like `grilling`, `devils-advocate`, `what-else`, or `× fable, grok` for fan-out overrides the default grilling), #do (fulfill; replace the bullet with a link to a new note, or inline if small), #align (comment). #retro, #to-spec, #implement: comment "not handled yet". an open thread (last comment is the user's) on a #question bullet is answered as a reply.
- lib/route.ts: drop the keymap parser; `route(workflow, block)` returns (model, effort) only; the lens is explicit. lib/augment.ts becomes the palette-side caller of the same act().
- skill `vault` in skills/enabled/all/mlegls/ (find where the others live): one paragraph, calls the library, summarizes what it wrote, and lists blocks it declined.

done: editing a vault note to add a #question bullet and a #do bullet, then `/skill:vault` in a session, yields a comment under the first and a link under the second, with nothing else in the notes changed; a second run with no edits does nothing.
