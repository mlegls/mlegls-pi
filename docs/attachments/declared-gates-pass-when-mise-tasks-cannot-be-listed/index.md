# Declared gate discovery verification

## Before first use: predictions

From the ticket and setup handoff only:
- A configured checkout whose `mise tasks ls --json` fails should produce a failing gate, identifying the command and stderr, rather than silently yielding no gates.
- Unparseable task-list output should likewise fail closed.
- A checkout with neither `mise.toml` nor `.mise.toml` should yield no declared gates.
- The supplied developer-facing entry point, `bun test lib/reconcile/checks.test.ts`, should finish successfully and report coverage of those cases.

## Setup and encounter

Tested revision: c819002b37efd94fb5c5bed5691dcb7c2ac4cb4a. Local library/developer test-runner surface; no authentication or servers. Own target is the drive worktree `declared-gates-pass-when-mise-tasks-cannot-be-listed-drive-2`, not the implementer's inherited checkout. The handoff says the entry point creates and removes isolated temporary checkouts and a stub mise executable. No deployment selectors or external seeded data were reused. Working tree was clean before this packet.

Predictions above were written before starting the entry command. On 2026-11-02, ran `bun test lib/reconcile/checks.test.ts` from this checkout as the handoff's developer persona. Bun 1.4.4 completed successfully: 4 pass, 0 fail, 17 expectations, 1 file, 114 ms. This established readiness and delivered the test-runner surface without additional setup. No source, test contents, fixtures or diffs were read.

## Outcomes and expectations

| Required claim | Observed evidence | Outcome |
| --- | --- | --- |
| Task-list discovery failures hold a gate with command diagnostics, including invalid output | Runner reported `declared gate discovery failures hold the gate with command diagnostics` passing | held through supplied runner |
| No mise configuration yields no declared gates | Runner reported `a checkout without mise configuration has no declared gates` passing | held through supplied runner |

The other two reported passing cases were `isAncestor reads exit 1 as not an ancestor and reports other failures` and `a failed gate's report keeps the failing tail and exit, not the head its message repeats`.

All pre-use expectations were met at the supplied runner surface. The runner groups discovery-failure variants under one label; it does not print each variant or an actual diagnostic. This is runner-level acceptance, not an independently observed live landing or a separately inspected malformed-JSON result. The reviewer should establish coverage of those details from the implementation and assertions; the driver deliberately did not inspect them.

## Replayable checks

1. At the tested revision, run `bun test lib/reconcile/checks.test.ts`. Accept exit 0, the discovery-failure diagnostics case passing, and the no-configuration case passing. Observed: those conditions held, with 4 total passing cases.
2. During review, confirm the discovery-failure case includes both command failure with stderr and malformed JSON; accept a failed gate naming `mise tasks ls --json` and the relevant error, rather than an empty gate list. The developer runner's aggregate label alone cannot distinguish those variants.

## Frictions and cleanup

No unresolved product or tooling friction encountered. No rendered UI journey, screenshots, servers, browser pages or external resources. The managed runner exited normally; nothing remains running. Evidence is intentionally summarized rather than a raw output dump.
