---
next: grill
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

sort every skill under `~/.config/system-config/skills/enabled` into: conventions (tracker, testing, project-docs, setup-project, writing-skills) → reference docs loaded on demand; procedures (dispatch, compile, orchestrate, advance, implement, verify-story, simplify) → workflow scripts with jev at branches; stances (grilling, what-else, devils-advocate, variety, show-me) → prompts, spawnable or loadable. one index over all three replaces the skill list in the system prompt, with the plugin-writing entry.

grill: which stances are agents (spawnable) vs modes (loaded in-session) — the last reason to keep a skill loader; and what happens to the third-party skills (workmux, pstack, humanlayer, wizard).

decisions:
- 2026-09-18: spawnable vs loadable is not a property of a stance; it's the caller's choice of who answers. stances are prompt fragments an ask is composed with (`show-me` also guides auto-summaries, not only the human). `introduce`/`advance` are the interactive entrypoints; `what-else`/`devils-advocate` are end-of-session lenses.
- 2026-09-18: a procedure that needs the model mid-run forks the session as a worker rather than yielding control back: "[[projects/mlegls-pi/issues/fork-spawn]]". mechanical steps become `lib/` functions either way; a script owns control flow only when the flow between asks is worth having in code.
- 2026-09-18: the index lives in this repo; `repo-merge` moves the rest here.

still open: what a stance-as-fragment looks like in the index vs an entrypoint; third-party skills (workmux → one conventions doc, wizard → procedure, pstack → drop unless used since Sep 7).
