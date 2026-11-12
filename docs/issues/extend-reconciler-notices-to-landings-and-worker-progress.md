---
stage: "done"
assignee: "agent"
priority: 2
author: "thread:thr_879y94y97m"
---
The concept supervisor @thread:thr_ihbpyrp6s2 still spends model turns on reconciler notices that need nothing from it. The efficiency audit of 2026-11-12 (@thread:thr_879y94y97m, both auditors) counted, over 11-09..11-12: 26 `[reconcile X] done: … landed` notices at $12.2 (7 of those replies used no tool), and about $8.5 more on `parked`, `withdrew` and `stopped` notices and on progress `bb thread tell`s from reconciler-owned workers that asked for nothing. Worker completion notices are already absorbed by [[projects/mlegls-pi/issues/drop-reconciler-worker-notices-in-a-bb-plugin]].

decisions:
- 2026-11-12: these notices join context without a model turn; landings are no longer announced in chat, and `reconcile_status` still lists them (maintainer, approving the audit's proposal in @thread:thr_879y94y97m).

## tasks
1. Extend [extensions/bb/reconciler-notices.ts](../../extensions/bb/reconciler-notices.ts) to treat `done … landed`, `parked`, `withdrew` and `stopped` notices, and `[bb message from thread:…]` messages from reconciler-owned workers, like completion notices. Keep a model turn when the notice carries a recorded follow-up for the supervisor or an exception.
2. Add to [agents/_common.md](../../agents/_common.md): "Report through your final handoff; don't `bb thread tell` your parent unless you need an answer."

Done when: a replay of those notice kinds leaves the supervisor idle with no model call, and an exception notice still wakes it.

## Result

done — I found and fixed two defects in the notice-gating logic, and all four stories now hold on my final head.

The two defects were in `needsOwner` in `extensions/bb/reconciler-notices.ts`:
- **Caveats kept the model awake.** `handoff.caveats` counted as a recorded follow-up. In this repo's `.git/reconcile`, every run state but one that holds a result has nonempty caveats. Landed, parked and stopped notices would almost always have woken the model, so the ticket's saving wouldn't exist. I dropped caveats; a result's `question` or `followup` and any pending exception still keep a model turn.
- **Worker notices were over-gated.** Worker completion and `[bb message …]` notices also waited on `needsOwner`. Any pending exception, or a question in any closed result, would have turned model turns back on for worker completions that were already absorbed unconditionally. They now settle locally whenever the worker's receipt belongs to a live run, as before. A worker message containing `?`, `needs-input` or `blocked` still reaches the model, and exceptions wake the supervisor through their own `needs you` notice.

The driver couldn't set up the recorded-follow-up story. I replayed `reconcilerCompletion` against a scratch repo with a fixture run state, and all 13 cases matched. I added no tests, so none changed. This replay is recorded in `drive.md`.
- **Settled locally (no model call):** landed with caveats only, worker completion with caveats, worker completion with an exception elsewhere, worker progress, and parked/withdrew/stopped.
- **Reach the model:** landed with a `question`, landed with a pending exception, a worker message with `?`, `needs you`, "landed … but a merge hook failed", and a landed notice folded with `needs you`.
- **Checks:** `bunx tsc --noEmit` is clean. `bun test lib/notice.test.ts lib/thread/bb-pi.test.ts` passes. `mise run test:affected` isn't a task in this project, so I ran those two files directly.

I closed the friction issue `notice-replay-setup-does-not-expose-recorded-followup-state`. The packet's `index.md` now names the state file to edit (`<root>/.git/reconcile/notice-fixture.json`) and the fields that matter.

```yaml
commit: f8869c32
stories:
  - story: Landed, parked, withdrew and stopped notices avoid a model call
    outcome: held
  - story: Reconciler-owned worker progress avoids a model call
    outcome: held
  - story: Exception notice wakes the supervisor model
    outcome: held
  - story: Recorded follow-up preserves a supervisor model turn
    outcome: held
evidence:
  path: docs/attachments/extend-reconciler-notices-to-landings-and-worker-progress/index.md
  visual: false
  shots: []
tests: []
filed: []
fixed:
  - "f8869c32: caveats and worker-path gating no longer keep a model turn (needsOwner); packet updated"
redrive: false
caveats:
  - "Replay checked the gate decision (`reconcilerCompletion`); the live end-to-end paths (empty local reply, exception reaching the provider) are from the driver's RPC run on the pre-repair head. The repair doesn't touch those paths."
  - "A pending exception anywhere in a run turns its landed/parked/withdrew/stopped notices back into model turns. Deliberate: conservative."
  - "`followup` is a handoff key nobody writes today; only `question` is live. It's kept because the ticket names recorded follow-ups."
  - "Provider-side filtering of empty local assistant replies was not measured (driver's caveat stands)."
  - "Nothing of mine is left running."
```

Evidence: [docs/attachments/extend-reconciler-notices-to-landings-and-worker-progress/index.md](../attachments/extend-reconciler-notices-to-landings-and-worker-progress/index.md)
