# Owner notice replay

## First use

```sh
bun docs/attachments/reconciler-worker-notices-wake-the-supervisor-again/rpc-fixture.ts
```

The fixture starts Pi RPC in a disposable Git checkout under this worktree's `.wm/`, seeds two worker receipts, and prints `NOTICE_RPC_READY` after Pi selects the scripted fallback model. The caller is a supervisor receiving BB input shapes; both providers are local and need no credentials. The command removes its scratch checkout and stops Pi when it exits. Observed on Pi 1.5.2:

| Input delivered to Pi | Observed settlement |
| --- | --- |
| Single completion while the chain exists | `bb-local`, empty reply, 0 tokens |
| The same completion after the finished run drops the chain | `bb-local`, empty reply, 0 tokens |
| Group with two receipted workers | `bb-local`, empty reply, 0 tokens |
| Group containing an ordinary child | Fallback provider |
| Owner exception and maintainer prompt | Fallback provider |

The [receipt regression](../../../extensions/bb/reconciler-notices.test.ts) also reads a stopped run's receipt in a new process. The [status regression](../../../lib/reconcile/exceptions.test.ts) starts a reconciler with a saved missing-status hold and drives it through the BB transport fixture. A valid report in the window clears the hold without either a request or withdrawal mail; a saved hold past the deadline sends one owner request. The [exit regression](../../../lib/session-meta/index.test.ts) exercises idle, working reconciler and ordinary working child observations.

## Full day from the audit

On the host holding the audit's BB/Pi state and the Concept checkout:

```sh
bun docs/attachments/reconciler-worker-notices-wake-the-supervisor-again/replay-day.ts \
  ~/dev/mmon/concept thr_ihbpyrp6s2 2026-11-22T00:00:00+08:00
```

The replay reads the original supervisor thread's Pi input records for one Shanghai calendar day. BB thread `thr_ihbpyrp6s2` joins to `pi_5fc06d62-6052-491d-b0cf-d9b19763ea09`; child-exit Pi session IDs join to the reconciler's `workerSessions` receipts, and BB completion thread IDs go through the production notice filter against saved run state. Maintainer inputs are matched to BB prompt history after separating machine notices. The command prints counts and unclassified entry IDs, without copying prompt bodies or mutating the original checkout. It uses the run receipts available now; it does not recreate historical PIDs or queue timing.

Observed 300 inputs: 226 singles and 2 groups settled locally; 16 idle exits would have produced no input. Another 6 bookkeeping notices and 24 landing messages settled locally; landings remain available in the next real turn's context. The 26 inputs reaching the fallback were 9 maintainer prompts, 16 exception messages and one direct answer about an exception (Pi entry `5ffaea95`, BB sender `thr_qzmws8vsg8`, diagnosing the closed-under-active-chain hold). No missing-status escalation was recorded that day; the status regression drives both elapsed-time outcomes separately.
