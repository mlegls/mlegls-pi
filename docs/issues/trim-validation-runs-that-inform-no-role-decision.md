---
stage: ticket
assignee: agent
priority: 3
author: "session:95cf9e55-d246-406a-a3bc-f0780b3b2a49"
---

Roles stop running checks whose result is already known or feeds no decision of theirs. From the [[projects/concept/attachments/streamline-validation-by-value-and-wall-time/index|validation runs audit]] ([[projects/concept/issues/streamline-validation-by-value-and-wall-time]]), over 2026-08-29 to 2026-10-02:

- implement ran `bun run check` 856 times; the commit hook runs typecheck and lint on every commit anyway and refuses the commit on failure.
- drive ran 120 unit and 105 check commands; its role judges what the user experiences without reading source.
- about half of failed browser runs were environment or invocation (services down, wrong port, deployment not ready, wrong filter), found after the run's setup.
- implement reports `scc:delta` and the jev-lint queue on every ticket (82 + 79 min); no reviewer decision has been traced to either.

Changes in `agents/roles/`:

- implement: don't hand-run checks the commit hook runs; let the hook's refusal be the signal.
- drive: no unit tests or repository checks.
- every role: before a browser run, check the deployment is ready (the project's readiness script, e.g. concept's `scripts/wait-for-local-deployment.mjs`) and stop on not-ready instead of running specs.
- `scc:delta` and jev-lint stop being required reports on every implement; the project instruction stays where it gates (`simplify:check`).

Done when the role files say this and a ticket's implement → review → drive runs show none of the dropped commands.
