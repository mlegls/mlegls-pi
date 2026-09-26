# Review and verification cost retrospective

The old reviews were relatively short; repair and re-review made the gate expensive. Current verification is not uniformly successful acceptance: many runs stop at setup, resume after intervention, or declare done with unobserved requirements.

## Scope and measurement

Local Pi transcripts sampled on 2026-09-26, around 15:20 UTC. The companion CSV records transcript paths and measurements. This is an observational retrospective, not a controlled comparison or an exhaustive historical spending total. Claude and other harness transcripts were not included.

The old cohort is 11 manually identified parallel code-review rounds (39 workers), September 2–9: nxt, Common Concept and Arkhai. It excludes deployment-packet review, documentation review, general audits and most follow-up rounds. Current verification includes all 97 discovered sessions starting with the verify agent's literal `verify-story` preamble on September 25–26 (UTC), including failed attempts. Sessions without assistant messages are excluded. The scan includes nested subagent session files.

Costs sum assistant `usage.cost.total` across each transcript. These are harness-recorded nominal model costs, not invoices, subscription consumption, or complete workflow costs. Tool-side model calls, browser classifiers, supervisor work and unlisted children are not included. Models changed: old reviews used gpt-5.6-sol and gpt-6-astra; current verification mostly uses gpt-6-luna. Dollar differences cannot be attributed to workflow alone.

Old worker elapsed time runs from first user message to last assistant message; parallel gate time is the slowest worker (starts within the same second). Current elapsed time runs from first user message to last assistant status report beginning done/blocked/needs-input; this excludes later process-exit commentary but includes intervening waits, corrections and retries. Four current sessions have no such report. Status is self-reported, not adjudicated acceptance. Active sessions are censored at collection. Repeated sessions on one ticket are separate observations, not independent completed tickets.

Peak context is maximum recorded input + cacheRead + cacheWrite tokens in one assistant call. It measures context size, not attention or cognitive load. No branch-lineage deduplication was performed; figures describe recorded transcript usage.

## Old gate

| Round | Workers | Parallel minutes | Recorded USD |
|---|---:|---:|---:|
| nxt initial | 3 | 4.8 | 2.40 |
| nxt second | 3 | 3.7 | 2.42 |
| Concept core | 3 | 5.5 | 3.66 |
| Concept #266 | 3 | 5.9 | 6.68 |
| Concept #299 | 3 | 5.7 | 8.43 |
| Concept #275 | 4 | 2.9 | 3.93 |
| Concept #296 initial | 4 | 2.6 | 3.40 |
| Concept #296 second | 4 | 2.1 | 2.68 |
| Arkhai #154 | 4 | 0.9 | 2.17 |
| Arkhai #147 | 4 | 4.0 | 5.99 |
| Concept #346 | 4 | 4.7 | 9.03 |

Median round: **4.0 minutes / $3.66**. Total review-worker cost in this sample: **$50.79**. Median worker: **2.9 minutes / $1.01**.

Two traced cycles, including follow-up workers but excluding parent cost:

- Concept core: initial three reviews → repair → final recheck: **36.1 minutes / $10.30**. Repair alone: 24.0 minutes / $5.96. The repair report says all nine findings were implemented in six commits, including nonblocking reader-load suggestions.
- Concept #299: initial three reviews → repair → merge → exact-head validation: **56.2 minutes / $30.74**. Repair alone: 39.3 minutes / $17.46.

These are costs of reaching the repaired artifact, not evidence that the repairs were wasted.

Concrete reported catches:

- Core behavior review: experience records conflated across scopes, including a test endorsing cross-scope supersession.
- Core theory review: unsupported pedagogical implementations silently ran the built-in fold; inconsistent Edge semantics across consumers.
- #299: tutor Material editing rejected execution authority, focusing Material lost revision history, failed tools appeared indefinitely working. Behavior reviewer reported two targeted probes despite 18 existing tests passing. Several perspectives rediscovered the same defects.
- #275: one behavior reviewer found shared-View updates could overwrite another Mission's selection; the other three perspectives reported no actionable findings.

These are transcript findings and repair reports, not an independent re-audit of the historical code.

## Verification now

| UTC cohort | Sessions | Last reports: done / blocked / needs-input / absent | Median elapsed | p90 elapsed | Recorded USD total |
|---|---:|---|---:|---:|---:|
| September 25 | 63 | 43 / 14 / 3 / 3 | 2.9 min | 73.2 min | $13.06 |
| September 26 | 34 | 19 / 13 / 1 / 1 | 2.4 min | 13.3 min | $0.78 |

Elapsed quantiles exclude missing reports; p90 is the observed value at floor(0.9 × (n−1)). September 25 contains a 211-minute last-message session on gpt-6-sol costing $7.66; it is not representative of Luna pricing.

On September 26, **25/34 first status reports were blocked**, versus 13 blocked at the last report. There were 64 status reports across those 34 sessions. Seven of the 19 final done reports explicitly contained unobservable outcomes; one also contained a failed attribution requirement. These should not all count as acceptance.

Examples of elapsed time to the last status report:

- Composer clearance: **9.9 min**, after fixing local auth setup; desktop/mobile end-of-transcript observation, one related mobile claim unobservable.
- Humanized identifiers: **13.7 min**, several observed UI claims, others unobservable.
- Account names: **15.2 min**.
- Signed-in Hub chrome: **13.3 min**, detail/release routes unobservable.
- Emblem inventory: **24.5 min**, including a real asset-base-path repair; failed/unobservable claims remained.
- Managed Gateway charging: **15.6 min**, actual Cloud-development call/debit, exhausted-credit and BYOK checks.
- Existing Storybook tests: **0.8 min**; ledger test replay: **0.9 min**. These are different evidence from a live browser encounter.
- Graph canvas: **1.5 min**, done despite the sole story being unobservable.

The stricter evidence packet and fresh visual judgment rules landed later on September 26 (`4bf7de6`), followed by permission to repair without role handoffs (`b6e210d`). Most of this sample predates those changes; it does not establish the new complete pipeline's latency or effectiveness. Fresh visual-reviewer costs are not included.

## Interpretation

The gate was removed September 9 in system-config commit `f89a87c`, immediately after `0fa40d9` introduced implement/verify-story. The motivating session explicitly proposed replacing four-pronged review with driving direct user stories, and moving minimalism, architectural work and broader testing into separately scoped passes.

Reviewers did carry smaller contexts in this sample: median peak **72k tokens**, versus **136k** in 17 implementation workers from the same historical campaigns. That supports the narrow fresh-context claim, not the stronger claim that hiding standards improves implementation. A 72k-token reviewer still reconstructs substantial context. Current verifiers' September 26 median peak was **29k**.

The evidence favors keeping independent first-use verification and avoiding mandatory four-perspective maintenance on every change. It does not justify abandoning source review for invariants that a short user journey cannot expose: authorization, cross-scope state, persistence, concurrency and migrations. A bounded risk-directed source review is a different intervention from restoring the old gate.

Keep constraints that determine implementation shape visible to the implementer. Delegate the exhaustive compliance pass, not the information needed to avoid architectural rework. Fixing style after implementation is cheap; discovering an incompatible ownership model afterward is not.

Before drawing stronger conclusions, measure verified acceptance per ticket (including setup retries, supervisor corrections and visual judgment), not session done labels. The current record's clearest defect is premature or unsupported acceptance, not demonstrated absence of a general code-standards reviewer.
