---
stage: ticket
assignee: agent
author: session:01a0e5e9-67b7-732e-90ce-7e6ac7a4ad76
---

Owner: `lib/jobs/supervise.ts` report handling. When a finished child's report has the wrong shape, the loop escalates to the owner with only "no status sentinel" or "review did not end with every story held". Typical shape errors: `done` last instead of first, `stories` as strings instead of `{story, outcome}`, `evidence` as a path string instead of `{path, visual, shots}`. The work itself was fine in every case. In one Concept tend session this caused about eight owner round trips across six tickets. Some were caused by the owner paraphrasing the format from memory.

Fix: send the specific validation failure straight back to the child (for example "stories[0] is a string; expected {story, outcome}"), together with the schema from `docs/verification-evidence.md`. Escalate to the owner only if it fails twice, or if a story's outcome really isn't `held`.
