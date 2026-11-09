---
stage: "done"
assignee: "agent"
author: "session:thr_nb7a3u9d6a"
priority: 3
---
When the configured observational-memory model isn't in the session's model registry, `resolveModel` in [runtime.ts](../../extensions/context/om/runtime.ts) falls back to the session model and says so only through `ctx.ui.notify` when `hasUI` is set. Headless sessions (bb-bridged workers, reconcilers, replays) switch silently, so memory can run on a 1M-window frontier model at its price, and an acceptance run can report results for a model it didn't use. [[projects/mlegls-pi/issues/om-configured-terra-model-is-absent-from-pi-catalog]] was exactly this lookup failing in a non-UI context (closed as a misdiagnosis of the catalog, not of the fallback). Found by the 2026-11-03 concept adversarial review (@thread:thr_hfihumwjwq), code checked.

## Acceptance

- A missing configured OM model is reported in every context: a UI warning as now, and otherwise a line in the session log or stderr naming the configured and the used model.
- Replays and other scripts that select an OM model fail rather than substitute.
- A test covers the headless case.

## Result

done

The runtime change was already correct. The diff had no test, which the ticket requires, so I added one.

- **Runtime:** `extensions/context/om/runtime.ts` now warns on stderr in headless sessions, naming the configured model and the session model used. The UI path still notifies as before.
- **Replays:** `replay-workers.ts` already fails with "Required exact replay model is not in Pi's catalog" when the exact model is absent, so the replay criterion needed no change.
- **New test:** `extensions/context/om/runtime.test.ts` has three cases:
  - headless fallback writes one stderr warning naming both models;
  - UI fallback notifies once and writes nothing to stderr;
  - an available configured model is used with no warning.
- **Check:** `bun test extensions/context/om/runtime.test.ts` passes 3/3. With the base `runtime.ts` swapped in, the headless case fails and the other two pass.
- **Packet:** I appended a review section to the packet's `index.md`; the driver's log is untouched. The test story is now held.

The `memory-as-a-log-with-pluggable-projections.md` tracker edit in the range comes from the merged base, not this change.

```yaml
commit: 93eee3da
stories:
  - story: Headless fallback reports configured and used models on stderr
    outcome: held
  - story: UI fallback emits a warning naming both models
    outcome: held
  - story: Available configured model is selected without fallback warning
    outcome: held
  - story: Worker and condenser replays reject an absent exact model
    outcome: held
  - story: A regression test covers the headless case
    outcome: held
evidence:
  path: docs/attachments/om-model-fallback-is-silent-without-a-ui/index.md
  visual: false
  shots: []
tests:
  - extensions/context/om/runtime.test.ts
caveats:
  - UI path is covered through a notify adapter, not a rendered terminal.
```

Evidence: [docs/attachments/om-model-fallback-is-silent-without-a-ui/index.md](../attachments/om-model-fallback-is-silent-without-a-ui/index.md)
