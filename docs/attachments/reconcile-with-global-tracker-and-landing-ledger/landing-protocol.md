# Durable landing protocol rehearsal

Implementation: `07a0d2e9`; disposable probe: `b37ec706328508ba59b9b63ffa823e09d7bbcf17`.
Observed 2026-10-12 with Bun 1.4.2, Git and mise on macOS. Nonvisual library/CLI journey; no screenshots.

## Setup and replay

The required and prepared environment is an isolated local Git repository with its own real global vault Tracker.
[landing-probe.ts](landing-probe.ts) creates a new fixture-owned temporary root on every invocation, seeds contracts through the checkout's bundled tracker CLI, registers real worker threads, and calls actual `integrate(keep:true)`.
It needs the package's completed `mise run setup`, Git, Bun, mise and zmx on the host; it launches no model, agent or worker process and needs no credentials.

From the package checkout:

```sh
bun docs/attachments/reconcile-with-global-tracker-and-landing-ledger/landing-probe.ts
```

From any other directory, pass that file's absolute path to Bun. The helper resolves package/CLI imports from its own location.
It clears inherited PI/BB/AB/zmx/worker/Git/tracker identities and supplies fixture-local state, cache, board, agent/prompt and zmx selectors, a zmx backend and `/bin/sh`.
Workers and the collector exclude `docs/issues/`; code evidence remains checked out.
No live campaign or shared tracker is reused. Worktrees, branches, registry/state files and temporary data are removed in its final cleanup.
The observed owner target was `/private/tmp/rc-ledger-qJYxn3/repo` (branch `main`), owned entirely by this invocation.
The persona is `user:landing-probe`, with local Git identity and no authentication.
Entry readiness was observed: the fixture completed and returned `RESULT`; all its assertions held.

## Collector then target

1. The registered leaf worker forked `tree-root`. A subsequent collector lockfile commit forced dependency preparation during rebase.
2. Leaf integration succeeded at code head `ef99e063c1d29dda053c23c2bc93cce086529f9d`. Its ledger was saved before actual thread retirement:

```yaml
leaf:
  into: root
  head: ef99e063c1d29dda053c23c2bc93cce086529f9d
  at: "2026-10-12T10:18:48.284Z"
```

The global leaf remained `stage: ticket`; the outside issue blocked by leaf was not frontier. Calling `closeAtTarget` made no write at this collector-only boundary.
After leaf retirement, restoring the saved state preserved its accepted handoff/result and cleanup receipt.

3. The registered root worker carried the collector code and committed its own join packet. Owner dependency changes forced preparation again. Root integration succeeded at `b5ae7ce2e95a25d3f8bda9047e42b9169757466e`.
Its operation saved destination-before `73ee78e229c540a27f602ed20fff90a5032558cb`, exact owner path, worker/collector receipts, `carried: [leaf]`, and that prepared head before merging.
One ledger save recorded root and transferred leaf:

| Entry | into | Containing code head | at |
| --- | --- | --- | --- |
| leaf | `/private/tmp/rc-ledger-qJYxn3/repo` | `b5ae7ce2e95a25d3f8bda9047e42b9169757466e` | `2026-10-12T10:18:48.284Z` |
| root | `/private/tmp/rc-ledger-qJYxn3/repo` | `b5ae7ce2e95a25d3f8bda9047e42b9169757466e` | `2026-10-12T10:18:50.119Z` |

A seeded foreign result whose saved parent was root but whose landing was into `other-collector` stayed there; it was neither carried nor closed.

Distinct saved results survived chain retirement and target close:

| Result | Saved parent | Summary | Own evidence locator inside scratch code |
| --- | --- | --- | --- |
| leaf | root | `leaf accepted summary` | `docs/attachments/probe/leaf.md` |
| root | null | `root accepted summary` | `docs/attachments/probe/root.md` |
| recovery | null | `recovery accepted summary` | `docs/attachments/probe/recovery.md` |

These synthetic packet paths belong to the disposable repository, not this package's enduring evidence. The full accepted handoffs, including extra nested metadata, were retained; blank summary used the reviewed report fallback.

## Interrupted close and merge recovery

- A deterministic Tracker wrapper delegated the real leaf close, then threw. Canonical leaf became done, root stayed open, and no leaf `closedAt` was saved.
- After restoring the saved state, a deterministic state-save refusal interrupted the next leaf close after the real method returned. In-memory `closedAt` rolled back.
- After another restore, exact pending close replay completed child-first. Calls were `leaf, leaf, leaf, root`, not a done-stage shortcut. Each issue's own summary/evidence appeared in its global Result; the outside issue became frontier. Tracker persistence advanced owner HEAD to `d8f9a1291894913bc73d2949da0b2763807ef002`, independently of the recorded code landing head.
- An already-landed root call used a deliberately nonexistent worker path and replacement result. It returned `replayed: true` without touching that worker or replacing the original reviewed result.
- A prepared-receipt save refusal returned a failure before merge. Destination remained `d8f9a1291894913bc73d2949da0b2763807ef002`, and recovery left the unprepared operation pending.
- A second deterministic refusal occurred *after* the recovery worker merged but before the ledger save. The helper threw rather than reporting a failed code landing. Disk retained `preparedHead: 26857ea1407db70adef76dee4f8773b166700971` and no recovery ledger entry.
- Restoring that state and invoking `recoverLandings` inside the integration lock recorded the landing by ancestry. Saved prepared, merged and recovered heads all equaled `26857ea1407db70adef76dee4f8773b166700971`; destination HEAD did not change. Subsequent `landReviewed` returned `replayed: true`, retaining the original result.

Operations/results/ledger remain audit. Leaf, root and recovery cleanup confirmations were saved only after actual worker retirement (and root collector removal). Restoring after root chain/collector removal still left its operation available to confirm cleanup.

## Refusals and gate order

Successful leaf and root order was `deps → gate → test`, followed by successful packet validation and the prepared receipt.
A missing packet failed after `gate → test`, demonstrating packet validation does not bypass retained tests. A failed declared gate stopped at `gate` with no test execution.
All failure cases preserved destination HEAD, landing ledger, absence of a reviewed result and global ticket stage:

| Failure | Destination before = after | Worker before = after | Diagnostic / observed order |
| --- | --- | --- | --- |
| declared gate | `c2e1dbc7283cafe270c661344c53725760eceec2` | `094374eae86dcefb967cab67fa750baa982a30eb` | `pre-integrate ERROR task failed`; `gate` |
| missing packet | `c2e1dbc7283cafe270c661344c53725760eceec2` | `4c069c86456479715d9413a7aba2fa5c2f315fe1` | `Missing or external evidence: docs/attachments/probe/missing.md`; `gate, test` |
| ordinary conflict | `3c2ec6650ffba08449c82ce18918358d8fe34032` | `d9f75577e95a525cd91d11695e7b42b33d5da3d9` | `code.txt`, `3c2ec66 Target conflict subject`; no gates |
| tracker append | `3c2ec6650ffba08449c82ce18918358d8fe34032` | `235156e5e2557313dffeb7bd3afbc8fed61dcfda` | `Forbidden tracker changes: docs/issues/branch-only.md`; no gates |

Both conflict checkouts stayed unchanged. Tracker refusal was not an append union. Recovery did not infer completion for failed/unprepared operations.

## Checks and boundary

- `bunx tsc --noEmit`: passed on the completed module.
- `bun test lib/reconcile/landing.test.ts`: 2 passed, 0 failed.
- Probe: passed, 24 successful state saves; cleanup audit remained for successful operations.
- No production call sites, State activation, Tracker/CLI writes, existing fixtures or retained tests changed.

This helper proves the dormant protocol through actual integration and global tracker writes. It does **not** prove actual scheduler dispatch, campaign restart, linked-owner execution or green-owner waiting. Those remain the enclosing ticket's activated actual-run join, as specified by this ticket's `drive: none`.
