---
next: implement
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
blocked-by: ["[[projects/mlegls-pi/issues/skills-triage]]"]
---

scripts import lib, agent prompts name lib functions, docs describe both: one repo. move skills (as sorted), agents, and agent-prompts from `~/.config/system-config` into this repo; system-config keeps the symlink and install layer. project-local plugins are exec modules under the project (`.pi/lib/*.ts` or similar), registered into the cell scope as `project.*`; upstreaming is moving the file.

done: system-config's `agents/`, `skills/`, `agent-prompts/` are symlinks or gone; `bun test` here covers the moved scripts; the system prompt's library entry points at one index.
