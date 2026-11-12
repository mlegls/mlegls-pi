---
stage: "idea"
assignee: "agent"
author: "session:a-name-is-an-agent-with-its-soul-skills-and-life-review-f"
priority: 4
---
idea: pi settings are read at least eight separate ways. Each of `lib/agents.ts` (registry), `extensions/context/notes.ts`, `elide.ts`, `journal.ts`, `mechanism.ts` (twice), `life/build.ts` and `om/config.ts` repeats the `[join(getAgentDir(), "settings.json"), join(cwd, ".pi", "settings.json")]` loop with a try/catch; the merge is shallow in some and per-key in others. `lib/agents.ts`'s registry reader was written to match the life's, which made it one more copy (seen in the join review of [[projects/mlegls-pi/issues/a-name-is-an-agent-with-its-soul-skills-and-life]]).

Question: one `readSettings(cwd)` in `lib/` returning the merged object, with each user taking its own section, if the merge depths can be unified without changing any effective value. Also three copies of `~/` expansion (`lib/agents.ts`, `lib/reconcile/completion.ts`, `extensions/workspace/workspace.ts`).
