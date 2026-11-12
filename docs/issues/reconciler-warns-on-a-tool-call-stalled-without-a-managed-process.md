---
stage: "done"
assignee: "agent"
priority: 2
author: "thread:thr_879y94y97m"
---
The final review of Concept's `make-large-card-imports-scale-in-one-tutor-script` tree, @thread:thr_mjg3wfmkct, sat 16h 40m in one bash call (11-10 22:32Z to 11-11 15:12Z) and nothing noticed: the reconciler's stall alarm (`waiting stalled` in [lib/reconcile/reconcile.ts](../../lib/reconcile/reconcile.ts)) only covers workers that reported `waiting`. Found by the efficiency audit of 2026-11-12 (@thread:thr_879y94y97m). The cause of that one is [[projects/mlegls-pi/issues/bash-timeout-read-as-milliseconds-blocks-a-worker-for-hours]]; this catches any cause.

decisions:
- 2026-11-12: warn the supervisor when a worker's current tool call has run over 45 minutes with no managed process (maintainer, approving the audit's proposal).

## tasks
1. Beside the `waiting stalled` check, raise one `tool call stalled` exception for an active worker whose in-flight tool call is older than 45 minutes while it owns no running managed process, naming the tool and command.
2. A test beside the existing stall tests.

Done when: a worker blocked in a single 50-minute bash call raises the exception once, and one waiting on a managed process does not.

## Verification evidence

[Fixture drive packet](../../docs/attachments/reconciler-warns-on-a-tool-call-stalled-without-a-managed-process/index.md): supplied entry point passed 18 cases at `413885ba36c29bdea920bbb0745799d33181c548`; packet committed as `715d6e5a`. Exception payload and deduplication details require reviewer assertion inspection; compact runner output reports only case success.

## Result

done. Both required stories hold on the final head. The new check works as the ticket asks; I found one defect and fixed it. No real 45-minute stall or live pi was observed.

- **Unmanaged 50-minute bash:** the test asserts exactly one log line and one owner tell over several reconcile ticks, at `owner` level. The text contains `Tool bash` and the command.
- **Managed process running:** the test asserts none of those.
- **Registry format:** it matches what pi-processes (`src/manager.ts`, `SessionSnapshot`) writes.
- **Nested calls:** pi 1.5 sets `parentToolCallId` on nested tool events. A bash inside codemode therefore reports the bash command, not the codemode script.
- **`since` meaning:** `since` on the live record now means the start of the current state, not the last write. Nothing else reads it.
- **Repair:** the two managed-process test titles printed a literal `%s`. They now read `managed process running: false` and `managed process running: true`. Both cases pass.
- **Tests:** `bun test lib/reconcile/exceptions.test.ts lib/session-meta/index.test.ts` passed (18) before the title change. After it I re-ran only the two renamed cases, which passed. No assertions changed.
- **Frictions:** the driver's `%s` friction was the only one, and it is fixed. The worker issue edits in the diff were already on the base.

```yaml
commit: 8bec0b6a
stories:
  - story: A 50-minute bash call without a managed process raises one stall exception
    outcome: held
  - story: A worker with a running managed process raises no tool-call stall exception
    outcome: held
evidence:
  path: docs/attachments/reconciler-warns-on-a-tool-call-stalled-without-a-managed-process/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/exceptions.test.ts
filed: []
caveats:
  - The fixture writes the live record directly, so tool_execution_start/end telemetry from a live pi (lib/session-meta/host.ts) has no test.
  - The test pays about 3 s per case for a 2.5 s reconcile window.
```

Evidence: [docs/attachments/reconciler-warns-on-a-tool-call-stalled-without-a-managed-process/index.md](../attachments/reconciler-warns-on-a-tool-call-stalled-without-a-managed-process/index.md)
