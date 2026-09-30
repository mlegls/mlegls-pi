---
stage: idea
assignee: agent
author: "session:01a0f0a3-40fd-704c-a4bb-6c7ef5dda151"
priority: 3
---

While reviewing [[projects/mlegls-pi/issues/ab-jg-can-stall-without-output-during-semantic-discovery]], `ab check -- bun test ab` (2026-09-30) selected tests outside `ab/`, including `skills/disabled/all/pstack/poteto-mode/scripts/watch-pr/cli.test.ts`; that file could not import `commander`. 91 tests passed, 1 failed. This was not a failure of the changed CLI.

Workaround: run the affected files explicitly with `ab check -- bun test ab/jevgrep.cli.test.ts ab/jevgrep.test.ts` (8 pass). Confirm the intended test scope and install or isolate dependencies for disabled-tool tests before treating `bun test ab` as an affected-suite check. The impact on other runners is unknown.
