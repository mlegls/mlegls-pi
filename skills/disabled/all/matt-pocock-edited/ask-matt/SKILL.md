---
name: ask-matt
description: "Use when asked which skill or workflow fits the situation."
disable-model-invocation: true
---

These are entry points into one workflow, not stages every request must pass.

- `/introduce` places something new in the codebase and ongoing work.
- `/advance` picks up tracked work or finds the next useful move.
- `/grilling` resolves understanding and choices. `/architecture` is for the
  concepts themselves; `/research` for facts; `/prototype` for a question whose
  answer needs to run or be seen.
- `/to-spec` makes settled intent portable. `/to-tickets` divides it when
  separate contexts or independently verifiable increments help.
- `/implement` builds the agreed change. `/implement-spec` coordinates a
  whole spec when orchestration is useful. `testing`, `code-review`, and
  `after-implementation` supply evidence and closure.

Small work can go straight from understanding to implementation. Larger work
may need a map of holes before there is a spec. The project's tracker docs
explain that representation; `/setup-project` installs missing conventions,
not a prerequisite ceremony for every repo.

Other useful entries:

- `/diagnosing-bugs`: make the failure observable and narrow its cause.
- `/revise-theory`: learn from changes that were harder than they should be.
- `/triage`: turn external issues or PRs into understood work.
- `/to-questionnaire`: ask someone outside the conversation.
- `/wizard`: make the human-only part of a procedure easy to perform.
- `/wait-what`: repair the explanation, not the user's knowledge.
- `/control-loop`: build an unattended loop around a valuable signal.

The conversation is a primary source; a spec or handoff preserves selected
meaning while losing detail. Use `/handoff` when context must travel. Otherwise
keep useful context while it helps and compact or reset when it does not.
There is no universal token threshold or mandatory reset between tickets.
