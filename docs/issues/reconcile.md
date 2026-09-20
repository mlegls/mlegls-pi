---
tags: [task]
next: implement
priority: 1
---

the outliner model in the vault note [[workflows]] (section outliner) replaces the tag-driven comment loop as the main path. a `reconcile` skill runs in an interactive session, so the model is whatever the session is; the library does the reading and the mechanical moves.

- `lib/outliner.ts`: `load(project)` reads the project's outliner note (`~/obsidian/<project>.md`, frontmatter `repo`/`directory` name the repo), its `## fleeting` and `## efforts` bullets with their tags and issue wiki-links, the tracker tree for that repo (`issues.ts tree` output or the same data via the tracker lib), and returns per bullet: status section, characteristic tags, linked issue and its live state (stage, claimed, archived) or none. `orphans()` lists live issues not linked from the outliner. `move(bullet, {to: 'efforts', issue})`, `mark(bullet, 'done')`, `remove(bullet)` edit the note guarded by content match (reuse lib/vault.ts writeBack). `attach` creates an issue through the tracker's introduce path when none exists.
- skill `reconcile` (skills/enabled/all/mlegls/): argument is an optional characteristic-tag filter. steps: load; list bullets in scope with what each resolves to and any contradiction (issue archived but bullet live, bullet says X and tracker says Y); discuss the new/unresolved ones in chat; propose one status move per bullet and show outliner edits as a diff before applying; make tracker edits directly. it replaces introduce; introduce's SKILL.md points at reconcile.
- `advance` unchanged. the #question/#do handlers in lib/vault.ts stay but the vault skill's description says they're off the main path.

done: on ~/obsidian/directing work from obsidian.md (already shaped idea / plans / fleeting / efforts; plans bullets link tracker issues too), `/skill:reconcile` lists every bullet with its resolution, offers to move the fleeting ones into efforts with issues, marks the archived one #done, and reports orphans; accepting applies the diff. leave the note in that state.
