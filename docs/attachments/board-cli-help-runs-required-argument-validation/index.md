# CLI first-use verification

## Setup and predictions (written before first use)

Tested revision: d2962137f9fe6cb1bb65cea741fb74a3c1ffb597. Local CLI in the assigned `board-cli-help-runs-required-argument-validation-drive-2` checkout; no authentication, seed, server, deployment selectors or ports. Parent reported `mise run setup` finished. Bun was available; the entry command below completed successfully, establishing readiness.

Predictions from the ticket:
- `--help`, `-h`, `help`, and command `--help` will print usage on stdout, no stderr, exit 0, even for commands needing arguments.
- An unknown command will print usage on stderr and exit 2.
- `wait` without `--from-offset` and `send` without a topic will print one error line plus usage on stderr, exit 2, and no stack trace.

## Encounter and replayable checks

Invoked the actual CLI from this checkout with subprocess capture to distinguish stdout, stderr and exit status (not a test suite). Eleven invocations, all matching the predictions:

| Action (`bun lib/board.ts …`) | Observed result / acceptance for replay |
| --- | --- |
| `--help`, `-h`, `help` | Each exits 0, stdout contains usage, stderr empty. |
| `wait --help`, `send --help` | Each exits 0, stdout contains usage, stderr empty; no required-argument error. Entry point `wait --help` works directly. |
| `cursor --help`, `read --help`, `list --help` | Each exits 0, stdout contains usage, stderr empty. |
| `not-a-command` | Exits 2, stdout empty, stderr contains usage only. |
| `wait` | Exits 2, stdout empty; stderr begins `error: --from-offset required (bun lib/board.ts cursor before spawn)` then usage. No stack trace. |
| `send` | Exits 2, stdout empty; stderr begins `error: topic required` then usage. No stack trace. |

The usage in these encounters lists cursor, send, read, list and wait, including `wait --topic glob [--tags expr] --from-offset n [--timeout ms]`. All help forms show the same useful global usage. The missing-argument cases each have exactly one error-message line followed by usage, without source snippets or stack frames.

Replay: run each row's command from the checkout and capture exit status and both streams separately (for example Python `subprocess.run(['bun', 'lib/board.ts', 'wait', '--help'], capture_output=True, text=True)`). Accept exactly the outcomes in the table.

## Outcomes

- Help discovery and validation bypass: held; prediction met.
- Unknown-command error behavior: held; prediction met.
- Missing-required-argument diagnostics: held; prediction met.
- Frictions: none encountered on this scoped journey. No additional expectations arose.
- No rendered UI, screenshots, tests, source inspection, product changes, services or cleanup required. Automated coverage is for the reviewer to assess, not this first-user encounter.
