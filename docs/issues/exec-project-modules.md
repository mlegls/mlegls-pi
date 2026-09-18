---
tags: [task]
status: "/"
claimed-by: frontier/0919/project-modules
next: implement
parent: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

project-local exec modules: `.pi/exec/<name>.ts` in the project shadows `lib/<name>.ts` with the same interface, and new files there enter the cell scope as `project.<name>`. upstreaming is moving the file. plus a `mlegls-pi` skill, the analogue of the `pi` skill: where this repo is, the module layout, how to add or override a module, how to test and reload — so the extension can be edited from any session.

where this came from: scripts are less malleable than prose skills; a project can't re-prompt a script. so the override path is what keeps a migrated procedure ("[[projects/mlegls-pi/issues/archive/skills-triage]]") as adaptable as the skill it replaces. `extensions/exec/modules.ts` resolves nothing project-local today.

done: a project override of `dispatch` is picked up in that project and ignored elsewhere; the skill exists and a fresh session can add a module by following it. the `dispatch` SKILL.md body is not shrunk to its call before this lands ("[[projects/mlegls-pi/issues/dispatch-script]]").
