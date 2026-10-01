# Role time audit

Where reconciler workers spend their time, per role (refine, implement, drive, review, handle), stance and model:effort. Remeasure after a routing or prompt change with a `--since` at its commit:

```sh
bun docs/attachments/role-time-audit/audit.ts --since <iso> [--until <iso>]
```

Active time is model latency plus tool time, from gaps between session entries (gaps over 10 min before a message, or 30 min before a tool result, count as idle). Cost is list price; on subscription capacity it is relative weight only. Drive turns are classified by what their tool calls touch, first match wins: a turn that clicks and appends to the log counts as `ui act`.

## Baseline: 2026-10-01, before `ff33bf3` (adjust agent models)

Five reconciler roots in mmon/concept and mlegls-pi; calc-ops and math-ops (toy fixtures) excluded. The garden run had up to 9 implementers plus browser suites on one host, so tool times there are inflated by contention.
### by role

| group | n | active min | % | median min | model:tool % | s/turn | checkpoint | median peak ctx k | $ % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| drive | 19 | 368 | 21 | 19 | 75:25 | 17.3 | 2/19 | 103 | 24 |
| handle | 6 | 8 | 0 | 1 | 96:4 | 12.3 | 0/6 | 40 | 1 |
| implement | 28 | 1097 | 63 | 37 | 63:37 | 31.0 | 16/28 | 176 | 50 |
| refine | 1 | 26 | 1 | 26 | 96:4 | 38.1 | 1/1 | 168 | 2 |
| review | 19 | 243 | 14 | 4 | 18:82 | 5.7 | 0/19 | 63 | 23 |

total active 1742 min over 73 sessions, list cost $64.43

### by role, stance and execution

| group | n | active min | % | median min | model:tool % | s/turn | checkpoint | median peak ctx k | $ % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| drive verify gpt-6.1-sol:high | 19 | 368 | 21 | 19 | 75:25 | 17.3 | 2/19 | 103 | 24 |
| handle handler gpt-6.1-sol:high | 6 | 8 | 0 | 1 | 96:4 | 12.3 | 0/6 | 40 | 1 |
| implement auto gpt-6.1-sol:high | 10 | 557 | 32 | 70 | 61:39 | 29.2 | 7/10 | 204 | 26 |
| implement auto-routine gpt-6-luna:max | 1 | 81 | 5 | 81 | 44:56 | 25.4 | 1/1 | 250 | 0 |
| implement fill gpt-6-luna:high | 1 | 6 | 0 | 6 | 85:15 | 8.0 | 0/1 | 68 | 0 |
| implement technical gpt-6.1-sol:high | 1 | 6 | 0 | 6 | 62:38 | 23.9 | 0/1 | 81 | 0 |
| implement technical gpt-6.1-sol:max | 15 | 448 | 26 | 25 | 69:31 | 36.3 | 8/15 | 162 | 23 |
| refine compile gpt-6.1-sol:xhigh | 1 | 26 | 1 | 26 | 96:4 | 38.1 | 1/1 | 168 | 2 |
| review reviewer claude-sonnet-5-5:high | 16 | 212 | 12 | 4 | 18:82 | 5.9 | 0/16 | 83 | 21 |
| review tidy claude-sonnet-5-5:high | 3 | 31 | 2 | 7 | 13:87 | 4.7 | 0/3 | 61 | 2 |

total active 1742 min over 73 sessions, list cost $64.43

### drive turns by kind

| kind | turns | model min |
| --- | --- | --- |
| packet write | 260 | 118 |
| ui act | 322 | 77 |
| setup/env | 150 | 33 |
| ui observe | 134 | 28 |
| read/other | 66 | 13 |
| no tool | 20 | 7 |

Other observations from the same sessions:

- Review is mostly test runs and integration-conflict repair: about 120 of its 186 tool minutes were `bun test`, `pre-integrate`, typecheck and browser specs, which implement ran before it and the integration gate (`mise run pre-integrate`) runs after it. Roughly 40% of review wall time came after the review's own report, repairing integration conflicts.
- 12 of 13 integration failures were conflicts in tracker files, mostly siblings appending recurrence observations to the same idea issue (concept `docs/issues/local-stop-cannot-terminate-checkout-owned-node-process-after-daemon-loss.md`); fold-author-workbench went through 3 send-backs, an exception and a handler twice.
- Reconciler handoffs are negligible: median 0.2 min from implement to drive and from drive to review.
- concept's full `bun test` on the same day: 321 s wall, 70 s user CPU; two tests took 231 s of it. `bun test --parallel`: 126 s.
