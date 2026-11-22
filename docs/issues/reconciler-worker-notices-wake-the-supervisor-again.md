---
stage: "done"
assignee: "agent"
priority: 2
author: "session:thr_vrgtjptnu2"
---
# Reconciler worker notices wake the supervisor again

[[drop-reconciler-worker-notices-in-a-bb-plugin]] answers a worker's bb completion notice locally, and the 11-16 audit verified it held. In 11-19→11-23 it leaked: the concept supervisor's own session (@thread:thr_ihbpyrp6s2, Opus) cost $139 against $24 the period before, about $111 of it on notices rather than the maintainer's 25 prompts. 77 of its replies amount to "nothing needs you", and about 1,100 "Worker completion noted." lines sit in the maintainer's thread. Found by the 2026-11-23 efficiency audit (@thread:thr_vrgtjptnu2; auditors @thread:thr_ujfhuerecr, @thread:thr_986r88by8h).

The leaks, from the audit:
- child-exit monitor (`lib/session-meta/host.ts`): 91 notices, $32.4. It fires for reconciler-owned workers, and 83 had "last state idle"; 39 came 30–35 min after the worker's last entry, which is bb reaping an idle runtime, not a worker ending.
- bb's grouped "Child thread updates:\n\n- @thread:X completed." notice: 53, $16.0, none answered locally (`extensions/bb/reconciler-notices.ts` matches only the single-notice form).
- single completion notices that missed the local reply: 165, $15.7 (1,097 were caught). The filter requires a live run and a current worker handle, so a worker completing after its run is `finished`/`stopping`, or after retirement, goes to the model.
- status-class owner exceptions raised before the worker's report settled: 21 of 55 were withdrawn by the reconciler itself, and the supervisor's resolutions raced the withdrawals.

## tasks

1. The child-exit monitor skips children whose spawn metadata carries a reconciler run, and exits whose last state was idle.
2. The local reply matches bb's grouped notice when every listed thread is a receipted worker (any non-worker in the group passes the whole notice through).
3. Keep a terminal receipt per worker thread, so a completion after its run finished, stopped or retired the worker still settles locally, across restarts.
4. Hold a status-class owner exception ~90 s and drop it if the worker reports in that window.
5. Done when: replaying one day of this period's supervisor inputs through the filters leaves only the maintainer's prompts, real exceptions and landings; a test per form above.

## Result

done

```yaml
commit:
  - checkout: /home/mlegls/dev/mlegls-pi__worktrees/reconciler-worker-notices-wake-the-supervisor-again-review-3
    commits: [23afe519]
  - checkout: /home/mlegls/dev/bb-plugins
    commits: [f24662c]
stories:
  - {story: "Suppress idle child exits in the audit-day replay", outcome: held}
  - {story: "Suppress working reconciler-owned exits while preserving ordinary working-child exits", outcome: held}
  - {story: "Settle all-worker groups locally and route mixed groups to fallback", outcome: held}
  - {story: "Settle completions after worker retirement and run finish", outcome: held}
  - {story: "Settle completions after run stop and supervisor restart", outcome: held}
  - {story: "Cancel status escalation on a timely report and escalate after the grace period otherwise", outcome: held}
  - {story: "Replay one audit day without spurious supervisor wakes", outcome: held}
evidence:
  path: docs/attachments/reconciler-worker-notices-wake-the-supervisor-again/drive.md
  visual: false
  shots: []
fixed:
  - "f24662c: accepted reconciler provenance in workerSpawn. Built and reloaded the path plugin from /home/mlegls/dev/bb-plugins/supervision; verified the live RPC accepted the new field."
  - "7a169dfe: saved recovered worker IDs through a surviving checkout during stop."
  - "1874805a: routed completions for dotted run slugs and verified mixed-group fallback byte for byte."
  - "1019def0: used BB-shaped IDs for workers spawned by the fake host."
tests:
  - extensions/bb/reconciler-notices.test.ts
  - lib/session-meta/index.test.ts
  - lib/reconcile/ownership.test.ts
  - lib/reconcile/exceptions.test.ts
filed: []
caveats:
  - "Other BB hosts need supervision f24662c or later loaded before the updated backend launches workers."
  - "An unresolved status hold delays owner mail by 90 seconds plus the reconciliation tick. The expiry check used a persisted hold aged 91 seconds."
```

Evidence: [docs/attachments/reconciler-worker-notices-wake-the-supervisor-again/drive.md](../attachments/reconciler-worker-notices-wake-the-supervisor-again/drive.md)
