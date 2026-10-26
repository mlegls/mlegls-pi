---
stage: "done"
assignee: "agent"
priority: 1
author: "session:thr_a35xhciju2"
---
Observed 2026-10-25 on the concept Beelink checkout: compare-tutor-models-on-material-quality-and-completeness-implement-3 ran an authorized paid Luna Lesson. It reported done and documented its retained state in the handoff: the deployment under packages/web/.convex/local/, and a private Convex export plus ledgers under .captures/material-model-comparison/ ("Preserve this worktree or that entire capture directory before retirement"). When the phase moved on to drive, the reconciler retired it through retireHandle(h, into, finished=true), which passes discardIgnored: true to retire. Every ignored path went with the worktree. Nothing reached __retired, the reconciler log has no "retired … keeping" line, and the owner got no notice. The drive then could not reopen the Session, so the paid draw is now readable only through its committed JSON.

The doc comment says "the worker reported done and its work was taken, so its ignored state is discarded". That holds for code changes. It doesn't hold for evidence and stateful work, where the ignored state is the deliverable a later phase opens.

Want: retirement never discards ignored state that isn't declared disposable (wm.disposable or the built-in DISPOSABLE lists), whether or not the worker finished. A finished worker's kept state gets the same RETIRED.md, log line and owner notice as an unfinished one.

Acceptance: a test where a worker that reported done is retired holding an undeclared .captures/x and packages/web/.convex/. Both end up under __retired with RETIRED.md, and the owner is told.

## Result

done — I found nothing to repair, and I made no changes on top of the driver's commit.

The change removes the `discardIgnored` option all the way down (retire, `abandonThread`, `retireThread`, `Worker.close`, `cleanupThread`). Retirement now always moves ignored state that isn't declared disposable aside. The `finished` flag only changes the wording of the owner notice. I found no leftover references to `discardIgnored`, and nothing under `docs/` or `skills/` describes the old behaviour.

I ran `lib/reconcile/retirement.test.ts`, `lib/thread/lifecycle.test.ts` and `lib/dispatch.test.ts`: 16 pass, 0 fail. I also ran all of `lib/reconcile`: 33 pass, 0 fail. The acceptance test retires a worker that reported done, holding `.captures/x`, `packages/web/.convex/local/state` and a regenerable `node_modules`. Both undeclared paths end up under `__retired/<handle>` with `RETIRED.md`, the reconciler log line is written, and the owner is told. `node_modules` is not kept.

The diff against the base also contains merged-in changes unrelated to this ticket: the OM `/om:compact-at` command and a host-gap issue file. I did not review those.

```yaml
stories:
  - story: Finished-worker retirement retains undeclared captures and Convex state with RETIRED.md and owner notification
    outcome: held
evidence:
  path: docs/attachments/finished-worker-retirement-discards-retained-ignored-state/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/retirement.test.ts
  - lib/thread/lifecycle.test.ts
  - lib/dispatch.test.ts
caveats:
  - "The `lib/thread/lifecycle.test.ts` case no longer covers a finished worker discarding its ignored state, because that behaviour is gone. I did not weigh in on whether the test is still needed. The `lib/dispatch.test.ts` close-call assertion also changed."
  - "Cost of this change: every finished worker's undeclared ignored state is now kept under `__retired`, so disk use grows until the owner deletes it. I did not measure how much."
  - "The driver's run used the fake-bb/temp-repository fixture only, so it never checked retirement against a real bb or the disposable lists."
```

Evidence: [docs/attachments/finished-worker-retirement-discards-retained-ignored-state/index.md](../attachments/finished-worker-retirement-discards-retained-ignored-state/index.md)
