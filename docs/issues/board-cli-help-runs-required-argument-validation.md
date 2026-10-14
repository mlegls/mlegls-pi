---
stage: done
author: session:01a0f2a6-53da-7002-8f28-50bc67077630
assignee: "agent"
---
Done: `bun lib/board.ts --help`, `-h`, `help` and `<cmd> --help` print the usage to stdout and exit 0 before any argument validation; an unknown command still prints usage to stderr and exits 2. A missing required argument (`wait` without `--from-offset`, `send` without topic) prints the one-line message and usage to stderr, exits 2, no stack trace. Covered in `lib/board.test.ts` (or a CLI test beside it).

shape: `lib/board.ts`'s `import.meta.main` block; wrap the switch so thrown validation errors print `error: <message>` and exit 2.

While driving [[projects/mlegls-pi/issues/archive/run-glob-misses-base-topic-decisions]], `bun lib/board.ts --help` printed useful usage but exited 2; `bun lib/board.ts wait --help` instead threw `--from-offset required (bun lib/board.ts cursor before spawn)` with a source stack trace. The user-facing CLI owns this friction; no implementation was inspected.

Workaround: use the top-level usage, capture `bun lib/board.ts cursor`, then call `wait --topic 'trial/**' --from-offset <offset> --timeout 2000`. This reached the intended waiting surface. [Observed output](../attachments/run-glob-misses-base-topic-decisions/drive-wait-setup.txt).

Proposed: make help return usage without running command validation. This is a discovery/help issue, not a failure of topic matching.

## Result

done

The change meets the ticket and I made no repairs. `bun test lib/board.test.ts` passes (3 tests). I did not run `mise run test:affected`.

- **Help:** `--help`, `-h`, `help` and `<cmd> --help` print usage to stdout and exit 0, before any validation.
- **Missing arguments:** `wait` without `--from-offset` and `send` without a topic print `error: <message>` plus usage to stderr and exit 2, with no stack trace.
- **Unknown command:** prints usage to stderr and exits 2.

The test in `lib/board.test.ts` covers all of these. It replaced the old assertion that `wait` without `--from-offset` exits non-zero. The new assertion is stricter, so the contract only tightened.

```yaml
commit: 7e9bf924
stories:
  - story: Help prints usage to stdout before validation and exits 0
    outcome: held
  - story: Unknown command prints usage to stderr and exits 2
    outcome: held
  - story: Missing arguments print one error line and usage without stack traces
    outcome: held
evidence:
  path: docs/attachments/board-cli-help-runs-required-argument-validation/index.md
  visual: false
  shots: []
tests:
  - lib/board.test.ts
caveats:
  - "Help detection scans every argument, so a flag value of `-h` or `--help` (for example `send t --body --help`) prints usage instead of being treated as the value. This is an edge case and I left it."
  - "Any error thrown inside the command switch now exits 2 with usage. That includes bad `--data` JSON and non-integer numeric flags."
```

Evidence: [docs/attachments/board-cli-help-runs-required-argument-validation/index.md](docs/attachments/board-cli-help-runs-required-argument-validation/index.md)
