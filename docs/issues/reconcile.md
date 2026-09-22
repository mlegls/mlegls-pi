---
tags: [task]
stage: spec
assignee: agent
priority: 1
---

the outliner replaces the tag-driven comment loop as the main path. The `vault` skill means interactive reconciliation, using the current session's model. The skill can operate with existing read/edit tools; a dedicated library for the mechanical moves remains below.

- `lib/outliner.ts`: `load(project)` reads the project's outliner note (`~/obsidian/<project>.md`, frontmatter `repo`/`directory` name the repo), its `## fleeting` and `## efforts` bullets with their tags and issue wiki-links, the tracker tree for that repo (`issues.ts tree` output or the same data via the tracker lib), and returns per bullet: status section, characteristic tags, linked issue and its live state (stage, claimed, archived) or none. `orphans()` lists live issues not linked from the outliner. `move(bullet, {to: 'efforts', issue})`, `mark(bullet, 'done')`, `remove(bullet)` edit the note guarded by content match (reuse lib/vault.ts writeBack). `attach` creates an issue through the tracker's introduce path when none exists.
- skill `vault` (skills/enabled/all/mlegls/vault/): note/project and optional characteristic-tag filter. Read plans, fleeting, and efforts; resolve against tracker and relevant code; surface contradictions and orphans; discuss unresolved intent; write agreed tracker changes; show and accept an outliner diff before applying. Introduce remains separate.
- `advance` unchanged. the #question/#do handlers in lib/vault.ts stay but the vault skill's description says they're off the main path.

done: on ~/obsidian/directing multi-agent work.md, `/skill:vault` lists in-scope bullets with their resolution and reports orphans; accepting proposed changes applies the shown diff. Exercise moves and completion marking where the actual state warrants them.

## decisions

- 2026-09-20: vault now means reconcile; the skill is updated, with explicit supertag processing retained in a reference. No separate reconcile skill or introduce redirect. Library mechanics and live acceptance verification remain open.
