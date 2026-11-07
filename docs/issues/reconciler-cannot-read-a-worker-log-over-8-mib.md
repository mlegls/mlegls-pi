---
stage: "ticket"
assignee: "agent"
priority: 1
author: "session:thr_fwxsihtum4"
---
goal: the reconciler reads a worker's report however long the worker's bb log is, and when it can't, it raises an exception instead of retrying silently.

## Observation

`rename-the-open-packages-to-mmon-co` (concept) stayed in `implement` for more than 13 hours, from 2026-11-06T13:29Z. Its worker @thread:thr_v7y3783ttt had reported `done` with a structured handoff (commits `f28465779`, `66e3aa3ec`). `.git/reconcile/rename-the-open-packages-to-mmon-co.log` in concept holds 6,170 copies of one line:

> reading rename-the-open-packages-to-mmon-co-implement-1 failed: … bb thread log thr_v7y3783ttt --all --after-seq 0 --json: Error: HTTP 413: Event response exceeds the 8 MiB limit

`lastTurn` ([lib/thread/turn.ts](../../lib/thread/turn.ts)) fetches every event after `seen`, which is 0 until a report has been read. Once a worker's events pass 8 MiB, every poll fails. `pollTurns` ([lib/reconcile/reconcile.ts](../../lib/reconcile/reconcile.ts)) only writes a note, so `reconcile_status` shows a healthy chain with no exception. Found by the concept adversarial review (@thread:thr_fwxsihtum4).

## shape

- Page the log: `--after-seq` without `--all` returns a bounded page, so walk forward from `seen`, keep only the newest `turn/completed` (and the `provider/error` before it), and advance `seen` past pages already read even when they hold no report.
- If a worker still can't be read after a few consecutive polls, raise an exception through the existing escalation path.
- Test: a fake `bb` whose unbounded log call fails with 413 and whose paged calls succeed returns the last turn.
