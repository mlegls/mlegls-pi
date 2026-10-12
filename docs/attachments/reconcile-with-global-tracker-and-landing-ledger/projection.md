# Collector-local scheduling projection

Tested code and disposable probe: **33b5aa7**, based on **06f87ba**.
Module: [scheduling.ts](../../../lib/reconcile/scheduling.ts).
Runnable surface: [projection-probe.ts](projection-probe.ts). Nonvisual, no screenshots.

## Setup and replay

Required environment: offline Bun plus the checkout's installed dependencies; no
models, credentials, browser, deployment or production reconciler. Worktree setup
completed before this encounter; typecheck and the probe both exited 0.

From the checkout:

```sh
bun docs/attachments/reconcile-with-global-tracker-and-landing-ledger/projection-probe.ts
bunx tsc --noEmit
```

The script also runs from any cwd when invoked with its absolute path. This was
replayed from `/tmp` using this worktree's absolute probe path.

Each run owns a fresh `mkdtemp` vault named `projection-probe-*` beneath the OS
temporary directory. It seeds 22 rows through the actual checkout-local tracker
CLI, with explicit `author: user:projection-probe`, then uses that CLI's snapshot
as the canonical comparator. The no-residual parent is created with a temporary
stage and updated to omit it after its child exists. The archived seed is moved
to the owned vault's `archive/` directory. The vault is a non-git fixture: no
canonical repository tracker or live campaign is read or written.

`TRACKER_CLI` is derived from `import.meta.dir`; `TRACKER_VAULT`,
`PI_BOARD_DIR`, `XDG_STATE_HOME`, `XDG_CACHE_HOME`, `PI_CODING_AGENT_DIR` and
`ZMX_DIR` point into that fresh vault. Inherited BB/session/thread/worker
identities are removed; `TRACKER_NO_INFLIGHT=1` disables derived display claims.
The script deletes only its owned temporary vault in `finally`. No processes or
other persistent targets remain.

The independently constructed DTO rows deliberately contain stale readiness,
stage, selectors and an undeclared `blockers: ["stale-rollup"]` input field.
Canonical `done` and the rolled-up stored claims are accurate. The helper must
reconstruct everything from own stages, raw relations and each row's own claims.
CLI and helper comparison sorts set-like arrays, not the lifecycle decisions.

## Observations

| Action / surface | Observed result |
| --- | --- |
| Empty ledger, no withheld nodes or matching run/attempt tokens; compare every DTO row with the actual CLI | All **22** rows matched own/effective stage, canonical done, readiness, eligibility, frontier, deferred, blockers, claims and selectors. |
| Compare the no-residual and own-done containers | `omitted` has no own assignment selector, while its child is selected. `own-done` remains unsatisfied, effective ticket, with only its unfinished child's selector. `lower`/`goal` both roll down to idea. |
| Seed ledger entries for `a`, `omitted-child`, `human` and `deferred-child` into collector `root` | `a`: canonical `done=false`, local `satisfied=true`; `b`: frontier, no blockers. `root` is frontier with its residual and `b` selectors. Its internal `b -> a` edge does not block the enclosing selection. Globally done `finished` and archived `archive` are also neutral completions; archived canonical `done` stays false. |
| Reuse that exact ledger in `other-collector` | `a` is unsatisfied; `b` remains non-frontier with blocker `a`. |
| Reuse that ledger with the absolute fixture owner path as `into` | `outside` remains non-frontier with blocker `a`; `b` is also blocked. Collector-local completion cannot release owner-path dependencies. |
| Land the omitted-stage parent's child | `omitted` becomes satisfied, effective done, ineligible, with no selectors. No ticket residual is invented. |
| Land human-assigned priority-4 child `human` | `residual` becomes agent-eligible, nondeferred, selecting only its own residual. The foreign stored claim on the satisfied child still appears exactly once and keeps the enclosing scope off frontier. |
| Inspect `guarded` after landing `a` in this context | Raw issue blocker `a` disappears, but missing issue `missing` and both opaque guards remain: `spec: [[projects/projection/issues/a]]` and `after: guard-child`. A guard containing a slug is not a satisfied issue relation. |
| Inspect priority-4 scope before/after landing its child, then explicitly select it without a landing | Automatic frontier is false before landing, true after landing; `explicit=true` also makes it frontier while `deferred=true`. Explicit selection does not bypass human eligibility or claims. |
| Ignore exact reservation `reconcile:root` and recorded attempt `reconcile:root/refine-active` | Owned claims no longer block this run. Unrecorded `reconcile:root/refine-unrecorded` stays as a foreign claim and keeps `lookalike` non-frontier. |
| Observe claimed child before acceptance, then promote it from spec to ticket | Its claim is ignored, but `provisional=true`, `satisfied=false`, and both its own and its enclosing scope's frontier remain false. Promotion does not accept it. |
| Remove that child from `withheld` using the same recorded attempt token | Child and enclosing scope become frontier. This is a fixture acceptance transition, not production refinement acceptance. |
| Re-query the actual CLI after all helper calls | Canonical snapshot is unchanged after JSON parsing. The helper never changes global lifecycle state. |
| Freeze input rows/nested arrays and the seeded ledger; compare snapshots and row identities afterward | Printed `Input immutability: true`: unchanged global map, ledger, context claim/withheld sets and new output rows. |

The final run printed `Projection probe passed` and `Deleted owned temporary
vault`; the any-cwd replay did likewise. `bunx tsc --noEmit` exited 0. There are
no existing retained tests importing this previously throwing dormant module;
none were added or changed. The actual CLI parity comparison is the ticket's
disposable first-use probe, not a retained test-suite import.

## Deliberate limit

This establishes only the private helper's projection contract. Production
selection remains dormant: no scheduler dispatch, real code integration,
landing-ledger persistence or global close was exercised here. The enclosing
ticket's actual-scheduler ledger rehearsal, **after atomic runtime activation**,
owns the post-landing gate and combined acceptance. This probe does not replace
that gate.

## Review (drive skipped: ticket is `drive: none`)

Reviewer read `lib/reconcile/scheduling.ts` against the ticket contract and the
CLI's `children/effectiveStage/complete/subtree/model/openBlockers`
(`issues.ts`), then replayed the implementer's evidence on the final head:
`bun .../projection-probe.ts` exited 0 (22-row CLI parity, collector/owner
contexts, immutability true, vault deleted, nothing left in the OS temp dir) and
`bunx tsc --noEmit` exited 0.

| Contract clause | Established by |
| --- | --- |
| Empty-overlay parity with the CLI projection | Probe parity comparison, 22/22 rows (replayed) |
| Landing releases b only in its collector; owner path stays blocked | Probe "Different collector" and "Owner path" output (replayed) |
| Omitted-stage parent, foreign claim, opaque guard, human residual, priority-4 scope, withheld claimed child | Probe rows for `omitted`, `human`/`residual`, `guarded`, `deferred`, `provisional*` (replayed) |
| No input mutation; no rollup `blockers` input | Probe immutability line; stale `blockers` seeded in DTO and overwritten |
| Code review: stage min over live children, `satisfied` rule, blocker/guard handling, own-claim recovery, exact ignore set, withheld suppression | Read side by side with CLI; no defects found, no repairs made |

No repairs, no tests added or changed, no ideas filed. Acceptance of production
selection rests on the enclosing ticket's join (actual scheduler ledger
rehearsal after atomic activation, owned by
`activate-global-reconcile-runtime` / the enclosing ticket), not this probe.
