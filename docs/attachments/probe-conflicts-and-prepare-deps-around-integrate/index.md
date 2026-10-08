# Landing verification

Independent drive at `6e554688cb898865b01132f5eaea10b8869ff4b1`: all four documented backend journeys held. See [predictions, encounter and replayable checks](drive.md). Nonvisual; no screenshots.

## Earlier implementation rehearsal

Implementation self-check at `99c2a6a` (setup repair `e4c8bcb`), 2026-10-08. This is not an independent driver's acceptance packet.

`land()` now probes inside its integration lock before rebasing. A conflict goes back to the child with the conflicting paths and the target's commits touching each path since the merge base. When rebasing changes dependency inputs, the repository's `deps` task (or its existing `setup` hook) runs before the gate.

## Setup and reproduction

Local Git fixtures, owned by the fixture process under `/tmp/rc-landing-*`. No model calls, authentication, credentials or running worker are needed. Each fixture seeds main and child branches, a thread registry record and a completed review report, then runs the real reconciler and reads its child mailbox or the landed branch. Fixture state and checkouts are removed afterward.

From a checkout containing this change, run `mise run setup`, then:

- `bun docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts conflict`
- `bun docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts deps`

Each command lands directly on the relevant backend journey and prints a `RESULT` JSON record. Additional modes are `setup` (fallback) and `unchanged` (no dependency-input change).

## Observed

- Conflict: the child mailbox named `conflict.txt` and `Target conflict subject`. Both branch heads remained unchanged; no setup or gate ran, and the issue stayed open.
- Rebased lockfile: the issue landed; the recorded task order was `deps`, then `gate`.
- No declared deps task: the issue landed with order `setup`, then `gate`.
- No changed dependency inputs: the issue landed with only `gate`.
- `bun test lib/reconcile`: 6 passed, 0 failed, including both approved landing scenarios.
- `mise run setup` and `bun run typecheck`: passed. The first typecheck exposed the nested Obsidian plugin's missing installation; repository setup now installs its committed frozen dependencies too.

The task-order log lives outside the child checkout because successful landing retires that checkout. No visual surface is involved. No host resources remain from these rehearsals.
