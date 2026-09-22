---
stage: done
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

scripts import lib, agent prompts name lib functions, docs describe both: one repo. move skills (as sorted), agents, and agent-prompts from `~/.config/system-config` into this repo; system-config keeps the symlink and install layer. project-local plugins: "[[projects/mlegls-pi/issues/archive/exec-project-modules]]".

done: system-config's `agents/`, `skills/`, `agent-prompts/` are symlinks or gone; `bun test` here covers the moved scripts; the skill list stays the index (skills-triage decision).

decisions:
- 2026-09-20: trees moved as-is into `agents/`, `skills/{enabled,disabled}/`, `agent-prompts/`. system-config those three names are relative symlinks to `~/dev/mlegls-pi`; `scripts/agents-apply.sh` follows them with `pwd -P` so harness links are physical. package.json `pi.skills` is only `./skills/pi` and `./skills/mlegls-pi` — `loadSkillsFromDir` recurses, so `./skills` would also register enabled and disabled user skills as package skills. tracker CLI: `bun run test:tracker` (3 pass / 406 asserts). after merging this branch, rerun `agents-apply.sh` so harness links leave the worktree for canonical.
- 2026-09-19: blocked on exec-project-modules: the override mechanism decides where moved scripts register.
- 2026-09-18: exec-project-modules landed ("[[projects/mlegls-pi/issues/archive/exec-project-modules]]"): override is `.pi/exec/<name>.ts` in the project, shadowing `lib/<name>.ts`.
