---
tags: [task]
stage: done
assignee: agent
priority: 1
---

the outliner replaces the tag-driven comment loop as the main path. The `vault` skill means interactive reconciliation, using the current session's model. The skill can operate with existing read/edit tools; a dedicated library for the mechanical moves remains below.

- `lib/outliner.ts`: `load(project)` reads the project's outliner note (`~/obsidian/<project>.md`, frontmatter `repo`/`directory` name the repo), its `## fleeting` and `## efforts` bullets with their tags and issue wiki-links, the tracker tree for that repo (`issues.ts tree` output or the same data via the tracker lib), and returns per bullet: status section, characteristic tags, linked issue and its live state (stage, claimed, archived) or none. `orphans()` lists live issues not linked from the outliner. `move(bullet, {to: 'efforts', issue})`, `mark(bullet, 'done')`, `remove(bullet)` edit the note guarded by content match (reuse lib/vault.ts writeBack). `attach` creates an issue through the tracker's introduce path when none exists.
- skill `vault` (skills/enabled/all/mlegls/vault/): note/project and optional characteristic-tag filter. Read plans, fleeting, and efforts; resolve against tracker and relevant code; surface contradictions and orphans; discuss unresolved intent; write agreed tracker changes; show and accept an outliner diff before applying. Introduce remains separate.
- `advance` unchanged. the #question/#do handlers in lib/vault.ts stay but the vault skill's description says they're off the main path.

done: on ~/obsidian/directing multi-agent work.md, `/skill:vault` lists in-scope bullets with their resolution and reports orphans; accepting proposed changes applies the shown diff. Exercise moves and completion marking where the actual state warrants them.

## result

`lib/outliner.ts` loads the note, tracker snapshot/tree, per-bullet sections/tags/issue state, and live orphans. `move`, `mark`, `remove`, and `attach` use guarded `lib/vault.ts` write-back; new attachments get a lifecycle issue draft with session provenance. `vault` now waits for explicit diff acceptance and routes new intent through `introduce`. `advance` and the tag handlers were not changed.

First use: `~/obsidian/directing multi-agent work.md` has no `repo`/`directory` frontmatter; its single issue namespace resolves it to `mlegls-pi`. The last load showed 3 plan bullets, 1 fleeting bullet, 0 efforts bullets, and 136 live orphans. `agentic-setup-reorg` is goal/live; `dispatch-script` is done/archived; `reconcile` is spec/claimed and `pool-aware-routing` is done/archived. The broad dispatch/autoread plan does not unambiguously warrant `#done`; the active reconcile item is a move candidate. No user-owned note edit was applied without acceptance.

A temporary fixture exercised moving a nested bullet without losing its child, marking done, removing, attaching a new issue, and reloading its tracker state. Existing tracker regressions: 17 passed. Focused library regressions: 12 passed. The full library suite, run through `ab check` with the worktree roster and inherited parent-session metadata removed, returned 165 passed, 2 skipped, 1 existing terminal failure; see [[projects/mlegls-pi/issues/session-terminal-regressions-fail-with-extra-shell-sessions]]. Root typecheck returned 56 existing diagnostics with no `lib/outliner.ts` or `lib/vault.ts` diagnostics; see [[projects/mlegls-pi/issues/root-typecheck-obsidian-environment]], [[projects/mlegls-pi/issues/root-board-store-fixture-typecheck]], and [[projects/mlegls-pi/issues/root-typecheck-memory-extension-errors]]. Worktree agent-roster friction is [[projects/mlegls-pi/issues/worktree-tests-read-canonical-agent-roster]].

## decisions

- 2026-09-20: vault now means reconcile; the skill is updated, with explicit supertag processing retained in a reference. No separate reconcile skill or introduce redirect. Library mechanics and live acceptance verification remain open.
- 2026-09-30: guarded outliner mechanics and first-use review are complete; no note edit was applied because the proposed live changes await explicit acceptance.
