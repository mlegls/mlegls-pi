# Base-topic decision reads: implementation first use

Revision: `c326e1c0641fbf5d64b24e6a3453d37aceb83629`.

The worker preamble, dispatch docs and multi-agent skill now teach `<run>/**` for run-wide reads/subscriptions. This preserves `matchTopic` semantics rather than giving `*` a special meaning. Globstar includes the base topic and nested runs; the instructions say so. Peer decision reads are unfiltered, separate from report-tag subscriptions.

## Setup and replay

Local Bun CLI from the committed checkout; no authentication or secrets. The replay creates an exclusively owned temporary board with synthetic decisions and one worker report. `PI_BOARD_DIR` overrides any inherited board selector, so the real shared board is untouched. The directory is removed on exit; no services are started. Dependencies were already installed in the implementation worktree; fresh checkouts use `bun run setup`.

Run this block from the repository root:

```bash
set -e
export PI_BOARD_DIR="$(mktemp -d)"
trap 'rm -rf "$PI_BOARD_DIR"' EXIT
export PI_BOARD_NAME=glob-first-use
bun lib/board.ts send trial --tag decision --body 'base decision' >/dev/null
bun lib/board.ts send trial/peer --tag decision --body 'peer decision' >/dev/null
bun lib/board.ts send trial/subrun/peer --tag decision --body 'nested decision' >/dev/null
bun lib/board.ts send other/peer --tag decision --body 'outside run' >/dev/null
bun lib/board.ts send trial/peer --tag done --body 'worker report' >/dev/null
printf '\nOld run-wide read:\n'
bun lib/board.ts read --topic 'trial/*' --fields meta
printf '\nNew run-wide read:\n'
bun lib/board.ts read --topic 'trial/**' --fields meta
printf '\nReport-filtered read:\n'
bun lib/board.ts read --topic 'trial/**' --tags 'done | blocked | needs-input | checkpoint' --fields meta
```

Observed on 2026-09-30:

| Read | Returned messages | Total / omitted |
| --- | --- | --- |
| `trial/*` | peer decision, worker report | 2 / 0 |
| `trial/**` | base decision, peer decision, nested decision, worker report | 4 / 0 |
| `trial/**` with report tags | worker report | 1 / 0 |

The new read includes base and child decisions, includes nested descendants as documented, and excludes `other/peer`. The report filter excludes decisions, which is why the coordination examples omit it. This was a CLI first-use trial, not a live multi-worker delivery measurement. No visual surface is affected.

Existing regressions: `ab check -- bun run test:board` — 30 pass, 0 fail, 142 expectations. `git diff --check` passed. No new permanent acceptance tests were added.

## Independent drive

[Predictions, actions, outcomes, frictions and replayable checks](drive.md), tested at `8b8438b77806884abc24b070845cf88cb7bb1783`. Both ticket stories held: the three instruction surfaces agree, and isolated CLI reads reach base/child decisions without crossing sibling-run boundaries. Selected output: [read replay](drive-cli.txt), [fresh waiting and Bash adapter](drive-wait.txt). Nonvisual; no screenshots. Host subscription delivery was not exercised in this Bash-only drive.
