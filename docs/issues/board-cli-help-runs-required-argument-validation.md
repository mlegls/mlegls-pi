---
stage: ticket
author: session:01a0f2a6-53da-7002-8f28-50bc67077630
assignee: "agent"
---
Done: `bun lib/board.ts --help`, `-h`, `help` and `<cmd> --help` print the usage to stdout and exit 0 before any argument validation; an unknown command still prints usage to stderr and exits 2. A missing required argument (`wait` without `--from-offset`, `send` without topic) prints the one-line message and usage to stderr, exits 2, no stack trace. Covered in `lib/board.test.ts` (or a CLI test beside it).

shape: `lib/board.ts`'s `import.meta.main` block; wrap the switch so thrown validation errors print `error: <message>` and exit 2.

While driving [[projects/mlegls-pi/issues/archive/run-glob-misses-base-topic-decisions]], `bun lib/board.ts --help` printed useful usage but exited 2; `bun lib/board.ts wait --help` instead threw `--from-offset required (bun lib/board.ts cursor before spawn)` with a source stack trace. The user-facing CLI owns this friction; no implementation was inspected.

Workaround: use the top-level usage, capture `bun lib/board.ts cursor`, then call `wait --topic 'trial/**' --from-offset <offset> --timeout 2000`. This reached the intended waiting surface. [Observed output](../attachments/run-glob-misses-base-topic-decisions/drive-wait-setup.txt).

Proposed: make help return usage without running command validation. This is a discovery/help issue, not a failure of topic matching.
