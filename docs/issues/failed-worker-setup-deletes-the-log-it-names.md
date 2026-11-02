---
stage: "done"
assignee: "agent"
priority: 2
author: "session:01a16efb-a47f-743e-b4b9-98781099fb47"
---
Seen twice on the concept Beelink checkout, 2026-10-25 (drive-and-review-planning-goal-corpus-refine-1 at 04:58 UTC, replay-recovered-tool-errors-from-recordings-drive-2 about 05:20): a reconciler launch fails with `Worker setup failed: 1 (see <worktree>/.wm/setup.log)` followed by `Partial resources cleaned`, and the cleanup removes the worktree, so the named setup.log no longer exists. Both succeeded on a plain retry, so the cause (likely contention while 6+ workers run mise run setup with local Convex deployments at once) is unknown.

Recurred on 2026-10-25 at 11:44 UTC in concept's `draw-every-node-token-with-the-design-libraries-node-mark` run: `arrange-the-map-free-layered-or-radial-drive-5` failed setup with exit 1; reading its named `.wm/setup.log` returned ENOENT after partial-resource cleanup. No matching retired checkout remained. The handler's fresh checkout at the same base completed setup at 11:45 UTC, including the Convex function push; a drive retry is the workaround, not a diagnosed cause (@thread:thr_bit4paiuwn).

Want: on a failed setup, keep the log: copy .wm/setup.log (tail is enough) into the reconcile log or a retained path such as .git/reconcile/setup-failures/<worker>.log before removing the worktree, and name that path in the exception text.

## Result

done

I reviewed `lib/thread/runtime.ts` and the `docs/dispatch.md` update against the ticket and found no defects. I made no repairs or commits. The existing tests pass (`runtime.test.ts` and `lifecycle.test.ts`, 11 tests, 0 failures) and `bunx tsc --noEmit` is clean. I didn't re-run the driver's rehearsal, because nothing changed after the driver ran it.

- **Retention:** the change copies `.wm/setup.log` into a unique directory under `<common git dir>/reconcile/setup-failures/<worker>-XXXXXX/setup.log` before cleanup. It rewrites the "see …" path in the exception and adds a `Setup log retained:` line. Because the destination is unique per attempt, repeating a worker name doesn't overwrite an earlier log.
- **Fallback:** if the copy fails, the worktree is kept with its original log and the error says so, rather than deleting the only copy.
- **Tracker friction:** the workers and driver linked none, so there was nothing to triage. The change also brought in unrelated tracker-doc and `declaredGates` commits from sibling merges; I didn't review those here.

```yaml
commit: 2b5b7689
stories:
  - story: Failed setup names a readable log surviving partial-resource cleanup
    outcome: held
  - story: Repeated failures for the same worker use distinct retained log paths
    outcome: held
evidence:
  path: docs/attachments/failed-worker-setup-deletes-the-log-it-names/index.md
  visual: false
  shots: []
tests:
  - lib/thread/runtime.test.ts
  - lib/thread/lifecycle.test.ts
caveats:
  - Driven only through the fake bb adapter with real Git and mise, not a live reconciler launch.
  - The original intermittent setup failure cause is still undiagnosed; this change only keeps its log.
  - Retained logs accumulate in .git/reconcile/setup-failures/ with no pruning.
  - No retention test was added; the driver's rehearsal stays in the packet as evidence.
```

Evidence: [docs/attachments/failed-worker-setup-deletes-the-log-it-names/index.md](../attachments/failed-worker-setup-deletes-the-log-it-names/index.md)
