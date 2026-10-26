---
stage: "done"
assignee: "agent"
priority: 2
author: "session:thr_zgjve7mckq"
---
idea: the efficiency audit of 2026-10-26 (@thread:thr_zgjve7mckq; auditor @thread:thr_ztepcfseav) counted 181 supervisor turns in 10-22→10-26, about $31, spent on "retired … kept ignored state" notices. Supervisors answered them with 625 `rm -rf` cleanups and restored kept state 3 times. 78 `~/dev/mmon/concept__retired` directories hold 7.1 GB. The maintainer agreed to quieter notices and pruning, provided retirement keeps what a worker declared: [[projects/mlegls-pi/issues/finished-worker-retirement-discards-retained-ignored-state]] records a paid run's `.convex` deployment lost by discarding, so marking `.convex` disposable is not the fix.

ticket: retirement keeps every path a worker's handoff names, finished or not (the linked ticket), and treats the rest of the kept ignored state as routine. Routine kept state goes to the reconciler log and `RETIRED.md`, not to a supervisor turn; the owner is told only when a kept path was declared in the handoff or is otherwise not routine setup output. A `__retired` directory is pruned once its branch is merged into its target and nothing in it was declared. Code lives in `lib/reconcile/reconcile.ts` and `lib/thread/lifecycle-cleanup.ts`.

Acceptance: a test retires a finished worker holding a declared `.captures/x` and undeclared `node_modules`-style setup output. The owner gets one notice naming `.captures/x` and none for the setup output. After the branch merges, the prune removes a `__retired` directory holding only routine state and keeps the one holding `.captures/x`.

Verification packet: [acceptance encounter](../../docs/attachments/retirement-notices-and-retired-checkouts-pile-up/index.md).

## Result

done — no repairs needed. `bun test lib/reconcile/retirement.test.ts lib/thread/lifecycle.test.ts` passes: 9 pass, 0 fail.

- **Notice:** the retirement test asserts exactly one owner notice, naming `.captures/x`. It asserts none for `node_modules` or `.wm/`.
- **Prune:** after the branch merges, the prune removes the routine-only `__retired` directory and keeps the one holding `.captures/x`. `.convex` stays in the owner notice as non-routine kept state.

```yaml
commit: 68e1d2e7
stories:
  - story: Finished retirement preserves declared captures and notifies without routine-output notices
    outcome: held
  - story: Merged routine-only retired state is pruned while declared captures remain
    outcome: held
  - story: Routine retained state is logged without supervisor intervention
    outcome: held
evidence:
  path: docs/attachments/retirement-notices-and-retired-checkouts-pile-up/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/retirement.test.ts
  - lib/thread/lifecycle.test.ts
caveats:
  - "Only retirements made after this change get a prune receipt (`retirement.json`). The 78 existing `__retired` directories (7.1 GB) have none and are never auto-pruned; they need a one-off manual clean."
  - "Only directories whose kept entries are all under `.wm/` are pruned. Any other non-disposable kept path, such as `local-db/`, stays and is announced to the owner."
  - "Declared paths come from a loose scan of the handoff text (backtick-quoted or whitespace-separated tokens that exist in the worktree and match an ignored entry). A prose mention of an ignored path also counts as declared. That errs towards keeping it."
  - "Cleanup now reads the worker's last turn via bb before stopping the thread. If bb can't be read, retirement throws and leaves the worktree in place instead of discarding a declared path. This costs one `bb thread log` and one `bb thread output` call per retirement, not timed."
  - "`lib/thread/lifecycle.test.ts` changed an assertion on the existing kept-state test, which now expects the new `attention` field."
```

Evidence: [docs/attachments/retirement-notices-and-retired-checkouts-pile-up/index.md](../attachments/retirement-notices-and-retired-checkouts-pile-up/index.md)
