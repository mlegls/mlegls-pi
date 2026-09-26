# Historical supervision transport failures

The retained failures were real, but their Paseo call paths are gone. No current transport defect was reproduced in this bounded follow-up. No production change or shared-daemon restart was needed.

## Original evidence

[Receipt](transport-recovery/receipt.json) extracts original events from session `01a0d667-d6d5-73e2-875e-e00ee6248ccc` and the retained local daemon log. The September 26 [friction review](session-friction-review-2026-09-26.md) had left these separately undiagnosed.

- **Busy owner notification failed the job.** Session metadata at line 301 identifies owner `97e2e1e0-915e-48c2-8bd3-0f9ecd53c817`. The same ID appears in the line-499 “already has an active run” error, although the reported child is `8b7c8ef9-…`. Daemon lines 131 and 231 confirm job failure, not just an assistant's diagnosis. Nested supervisors show the same pattern with their own owner IDs. At the historical call site, `wake` awaited `children.send`; the Paseo implementation called `client.agents.ref(id).send(text)`. A send failure could be caught as a child-loop error, then fail again while reporting that error to the same busy owner. Later logs also record “Cannot replace agent … cancellation was not acknowledged.” These belong to the existing [wake-noise owner](../issues/supervise-wakes-the-owner-once-per-streamed-chunk.md), not a new child-busy issue.
- **Lost Paseo connection failed jobs.** Daemon lines 39 and 229 record `DaemonConnectionError: Connection ended`; transcript lines 738 and 863 retain the failed job states. They establish transport failure, but not which socket operation or why the connection closed: the retained lines have no stack. The user reports a network interruption later at line 1049 (09:46 UTC); the already-recorded failures at 06:23/06:52 UTC cannot simply be attributed to that later report. Adjacent EPIPE output is not proof of a shared cause either.

## Repairs already present

`3f74345` added failed-watch backoff/reattachment and isolation of unreadable children. `f46b434` made failed owner notifications retry independently of child handling. The daemon log then records `wake deferred` rather than job failure for the same owner rejection (lines 511 and 523). This demonstrates that the old send rejection persisted after mitigation; it does not demonstrate eventual receipt.

`e5d70aa` removed the Paseo supervision/children transport; `f054765` removed its client dependency on September 26. Current `children.send(mail/…)` appends to the local board log. The board host retains notifications while busy, then delivers a follow-up when idle (or injects them before the next turn). It does not call Paseo to replace an active owner run. Current worker watches use workmux and board records, not a Paseo socket.

## Current checks

Audited source through `ef0c3b3`; other sessions advanced unrelated files during this pass. Run `bun docs/research/transport-recovery/probe.ts`:

1. Real `children.send`, board storage and board host, with a fake Pi lifecycle: two writes to a busy owner's mailbox cause no delivery; restoring saved pending state and becoming idle delivers both once, in order. Another restore/poll does not redeliver. No real model turn was started.
2. Real supervision loop and Git fixture, with fake tracker and injected transport errors: the first child watch fails, the retry gets a blocked report, the first notification write fails, and a retry delivers it while the next child watch is pending. Child state/cursor are retained; no redispatch or integration occurs. The normal 2-second watch and 5-second delivery delays run unchanged.
3. Twenty existing tests pass across `lib/children.test.ts`, `lib/wm-reattach.test.ts`, `lib/wm.test.ts`, `lib/jobs/supervise.test.ts` and `lib/board/store.test.ts`. These include unavailable/malformed workmux status remaining pending rather than being mistaken for a dead worker.

These are bounded current-contract checks, not a recreated historical Paseo outage. They do not measure network/provider recovery inside a model turn, delivery across an actual daemon crash before a failed board write succeeds, a real busy TUI's wake behavior, or long-running reliability. The board restore check replays persisted entries in-process, not an actual host restart. The wake-noise issue's separate streamed-prefix and supervisor check-in observations were not re-audited here.
