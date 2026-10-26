# Finished-worker retirement verification

## Before first use

Tested revision: `de21fd4f130f77dbb36a0b09412388380eeb69aa`.
Persona: developer invoking the implementer's supplied regression entry point. Deployment: local fake bb and temporary git repositories; no authentication or services. Owned target: this drive worktree, with temporary repositories created by the supplied runner. No inherited deployment selectors or paid state are reused. Readiness: Bun is available and checkout is clean before the evidence packet.

Entry point: `bun test lib/reconcile/retirement.test.ts`.

Predictions, recorded before execution:
- Finished workers with undeclared `.captures/x` and `packages/web/.convex/` retain both under `__retired`, receive `RETIRED.md`, and notify the owner; expect the supplied runner to report this scenario passing.
- Declared disposable state remains disposable; expect corresponding coverage to pass rather than preservation of every ignored file.
- Kept state generates a retention log notice; expect the supplied runner to cover the notice along with owner notification.

This is a nonvisual runner encounter using the exact supplied setup, not a live bb desktop or paid Convex session. No source, tests, fixtures or diffs were read.

## Encounter

Ran the supplied entry point with Bun 1.4.4. It exited 0: **1 pass, 0 fail, 15 expectations**, about 1.77 seconds. The named scenario was `a worker reporting done keeps undeclared captures and Convex state on retirement and tells its owner`.

Observed runner output: `launched root-drive-2 (drive, driver)` followed by `retired root-implement-1 keeping its ignored state at /tmp/rc-protocol-Z0QGZ9/repo__retired/root-implement-1: .captures/, packages/`.

### Outcomes and expectations

- **Held / met through the supplied regression surface:** finished-worker preservation of captures and Convex state, RETIRED.md and owner notification. The named acceptance scenario passed; individual filesystem and notification payload assertions were not independently inspected, in accordance with the no-source/no-fixtures driver boundary.
- **Held / met directly in output:** retention log notice points to the retained location and names both top-level retained paths.
- Disposable-state prediction was not measured by this entry point (only one scenario ran). It is not an additional acceptance story, and no broader regression claim is made here.

### Replayable checks

1. From the tested revision in a checkout with Bun, run `bun test lib/reconcile/retirement.test.ts`.
2. Accept an exit-0 run with the finished-worker captures/Convex/owner scenario passing and a `retired … keeping its ignored state at …__retired/…` notice listing `.captures/` and `packages/`.
3. The reviewer should confirm that the scenario's passing expectations actually establish both retained payloads, RETIRED.md and owner notification; runner output alone does not expose their contents.

### Frictions and limits

No interaction friction encountered. Evidence is the supplied fake-bb/temp-repository regression surface, not a real paid deployment recovery. No UI was rendered, no server or external deployment was started, and the runner has exited. No unresolved tooling defect was observed.
