---
tags: [task]
next: implement
blockedBy: ["[[projects/mlegls-pi/issues/exec-project-modules]]"]
parent: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

scripts import lib, agent prompts name lib functions, docs describe both: one repo. move skills (as sorted), agents, and agent-prompts from `~/.config/system-config` into this repo; system-config keeps the symlink and install layer. project-local plugins: "[[projects/mlegls-pi/issues/exec-project-modules]]".

done: system-config's `agents/`, `skills/`, `agent-prompts/` are symlinks or gone; `bun test` here covers the moved scripts; the skill list stays the index (skills-triage decision).

decisions:
- 2026-09-19: blocked on exec-project-modules: the override mechanism decides where moved scripts register.
