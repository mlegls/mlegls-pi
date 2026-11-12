# Reviewed snapshot ticket relaunched from a stale collector

Independent first-use verification: [drive-2 encounter](drive-2.md).

The reviewed landing was recorded in the enclosing collector, while the ticket remained open in a stale sub-collector. Each tick discarded the new chain because a landing existed, then launched it again because that landing's code was absent locally. Its `waiting` report never reached normal report handling.

## Historical join

Owner @thread:thr_ihbpyrp6s2, retained tool event 21540 (2026-11-09 08:48:19Z), run `make-large-card-imports-scale-in-one-tutor-script`:

- `results[restore-the-5000-card-fixture-from-a-snapshot].parent` is `bound-card-backed-session-resource-reads`.
- The same node's landing operation targets `make-large-card-imports-scale-in-one-tutor-script`, at `/home/mlegls/dev/mmon/concept__worktrees/make-large-card-imports-scale-in-one-tutor-script--tree`.
- Its reviewed worker is `restore-the-5000-card-fixture-from-a-snapshot-review-21`, @thread:thr_uhw67345ek. The ledger records `b2bc82c357a030fb87d61d319de5dba4787b8b18` at 08:10:52.679Z.
- The current chain is `implement`, into `bound-card-backed-session-resource-reads`, without a worker receipt. The retained log launches implement-29 through implement-2m at roughly two-minute intervals.

The owner's earlier handler handoff reparented the ticket and requested retry. `applyResolution` retries the existing chain with its captured `into`; changing the tracker parent doesn't change that destination. The review therefore landed upstream of the new parent. The old `catchUp` checked blockers and skipped frontier descendants, so this already-delivered, locally frontier ticket never triggered a merge. `tick` then removed every new chain solely because its slug was in the landing ledger, before `visit` could handle its report.

## Change and first use

Implementation: `db32528668c60649be909b189f3a6c6c553713c7`.

- Collector catch-up includes delivered descendants before scheduling them. If the recorded delivery still cannot reach its destination, the node raises an exception.
- An implementation/drive/review chain coexisting with an old landing is retained for the owner, including its worktree and running processes. Only an integrating chain can be cleaned up as completed by that ledger entry.
- Implementation admission records base, prerequisite state and intended handles in run state. Replaying a saved handle consumes no new attempt. Two identical starts exhaust admission across chain replacement; the third raises one pending owner exception.

Entry point, from this repository:

```sh
bun test lib/reconcile/scheduling.test.ts
```

The committed replay prepares isolated temporary Git repositories, a global vault tracker and fake-bb threads. No model, credentials, browser or Concept deployment is used. It removes its repositories and stops its reconciler processes on exit.

Observed: **2 tests passed, 34 assertions**. The replay covers:

1. A reviewed snapshot landing in R with stale nested S: S takes R's code; zero implementation spawns; the original ledger entry stays unchanged.
2. The same state with implement-23 already reporting `waiting` for `prepare-current-5000-card-fixture`: zero spawns, the worker receipt and unarchived thread survive, and one owner exception names the retained work.
3. A new worker reporting `waiting`: the same handle stays current and no second worker starts. After two blocked attempts with explicit unchanged-base redispatches, a third starts no worker and produces one stable exception. Two handles remain in the durable admission record.

Existing affected regressions: **16 tests passed** across `collector-catch-up`, `launch-recovery`, `exceptions`, `landing-cleanup`, `resume` and `retry`. `bun run typecheck` passed. No existing test assertions were weakened.

These observations use the fake worker backend. No live Concept reconciler, preparation process, cache lock or collector was modified.
