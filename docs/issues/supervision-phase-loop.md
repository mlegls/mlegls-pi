---
stage: done
assignee: agent
author: session:01a0cd1a-8da4-701c-8253-d1ab9fd2b4e6
part-of: "[[projects/mlegls-pi/issues/scripted-supervision-loop]]"
blocked-by: ["[[projects/mlegls-pi/issues/ab-daemon]]", "[[projects/mlegls-pi/issues/host-child-events]]", "[[projects/mlegls-pi/issues/worker-turn-end-report]]"]
---

The loop as an `ab daemon` job, replacing `lib/supervise.ts`: `ab supervise start <ticket>` from the owning LLM agent, `status`, `resume` after the owner answers. Shape and decisions are in the parent.

- start: tracker frontier of the subtree, Jev stance per ticket via `route.prepare` (honouring assignees), dispatch within the budget. Refuse to run sibling subtrees in parallel when one is blocked by the other's unfinished children.
- phases per leaf: implement → verify → integrate. Implementer `done` with a complete handoff, no caveats and clean lints → verifier from a template (ticket, stories, handoff), launched under the owner. Verifier held → `dispatch.integrate`, lints and tests, ticket done, next frontier. Everything else wakes the owner with ticket, recorded decisions and a report excerpt.
- non-leaf children get `supervise`; their single final report is an ordinary turn end.
- subtree done: one crossing-story verify if Jev sees crossings, then the owner's final report goes up.
- metrics per job: owner wakes, bytes delivered to the owner, children, accepted completions. These decide whether GLM is enough.

first use: a two-leaf toy subtree in a scratch repo, driven end to end with the owner woken once for a planted `needs-input`; then one real subtree in a project.

first use 2026-09-23: a two-leaf toy subtree (/tmp/sup-toy) ran end to end with the owner woken for the planted needs-input and once by the strict caveat rule ("no test suite configured"); two restarts on the way continued from carried state. A real subtree is the first use of [[projects/mlegls-pi/issues/supervise-as-exception-handler]].
