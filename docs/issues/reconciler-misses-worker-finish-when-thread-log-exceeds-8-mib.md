---
stage: "ticket"
assignee: "agent:technical"
author: "session:thr_ihbpyrp6s2"
priority: 2
---

A long-running worker's thread log can outgrow what the reconciler reads, so it misses the worker's finish. In concept, `rename-the-open-packages-to-mmon-co`'s implementer @thread:thr_v7y3783ttt finished cleanly on 2026-11-06 21:29, but the reconciler stayed in `implement` for about 14 hours; its log (`concept/.git/reconcile/rename-the-open-packages-to-mmon-co.log`) repeats:

```text
reading rename-the-open-packages-to-mmon-co-implement-1 failed: Error: …/bb thread log thr_v7y3783ttt --all --after-seq 0 --json: Error: HTTP 413: Event response exceeds the 8 MiB limit
```

Daily triage found it stalled; a manual stop and restart resumed from the worker's branch. Any worker whose log passes bb's 8 MiB event-response limit stalls the same way, silently except for that log line.

Where: `lib/thread/turn.ts` `lastTurn` reads `bb thread log <id> --all --after-seq <after> --json` and here `after` was 0, so every poll re-reads the whole log; `lib/thread/bb.ts` `bbSessionFile` reads `--all` from the start too. `bb thread log --json` pages with `--limit` (oldest first, default 100) and `--after-seq`; one page can itself exceed the limit when events are large.

## tasks

1. Read worker logs incrementally: keep the last seen seq per worker so polls fetch only new events, and page with `--limit`/`--after-seq` rather than `--all`; when a page returns 413, retry it with a smaller limit down to one event, and if a single event alone exceeds the limit, skip past it with a logged note rather than stalling. Same for `bbSessionFile` (it only needs the newest providerThreadId).
2. A read that keeps failing must surface as a reconciler exception to the owner after a bound, not only a log line, so a stalled chain is visible.
3. Cover it with the fake bb (`lib/thread/fake-bb.ts`): a log whose full read returns 413 still yields the final turn, and a persistent failure escalates.

## acceptance

- With the fake bb returning 413 for whole-log reads, the reconciler sees a worker's turn completion and advances the chain.
- A worker log that cannot be read at all produces an owner exception within the bound.
