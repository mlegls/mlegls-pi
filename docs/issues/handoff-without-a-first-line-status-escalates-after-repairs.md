---
stage: "done"
assignee: "agent"
author: "session:thr_ihbpyrp6s2"
---
On 2026-11-17 four concept workers finished with a complete YAML handoff but no status word on its first line: disposable-bb-projects-outlive-their-inspection, appearance-advice-repeats-after-its-document-was-offered, gate-card-problem-release-before-strict-activation and card-problem-migration-stops-on-an-unreadable-card-attachment. Twice the status was only inside the YAML (`status: done`) or the first line was the YAML fence. Each one used up both automatic repairs and then escalated to the owner as "status (after 2 repairs)" with an empty body, and the owner only had to ask for a repost. A report whose YAML carries an unambiguous `status:` (or whose shape is plainly a finished handoff: commit plus stories) could be accepted without asking. Failing that, the repair nudge could quote the rejected first line, so the worker can see what was wrong.

These are the four escalations @thread:thr_ihbpyrp6s2#msg=37365, #msg=37920, #msg=39072 and #msg=39796; a plain `retry` cleared three (2026-11-19 efficiency audit, @thread:thr_ivvhpy2bsb).

## tasks

1. Reconciler handoff parsing (`lib/reconcile/`): when the first line carries no status word, accept a report whose YAML block has one unambiguous `status:` value as that status, including a report whose first line is the YAML fence.
2. When a repair is still needed, the nudge quotes the rejected first line.
3. Done when: tests cover a YAML-only status accepted, a fence-first report accepted, and a missing or conflicting status still repaired with the quoted line.

## Result

done — Conflicting statuses across YAML blocks now keep the worker in `implement`. The repair quotes the rejected first line and names both statuses. All five stories held; 21 affected tests passed, and all fixture targets were stopped.

```yaml
commit: 472f56db
stories:
  - {story: YAML-only status after prose is accepted, outcome: held}
  - {story: Fence-first YAML status is accepted, outcome: held}
  - {story: Missing status triggers a repair quoting the first line, outcome: held}
  - {story: Conflicting keys within one YAML block trigger a repair quoting the first line, outcome: held}
  - {story: Conflicting statuses across YAML blocks trigger a repair quoting the first line, outcome: held}
evidence:
  path: docs/attachments/handoff-without-a-first-line-status-escalates-after-repairs/index.md
  visual: false
  shots: []
tests:
  - lib/report.test.ts
  - lib/reconcile/setup.test.ts
  - extensions/guard/index.test.ts
fixed:
  - Checked status agreement across all handoff blocks while retaining the first payload.
  - Labeled the fixture CLI’s immediate snapshot so operators know to check status for the processed outcome.
filed: []
caveats:
  - The retained reconciler check starts two isolated offline targets; together they took 7 seconds.
```

Evidence: [docs/attachments/handoff-without-a-first-line-status-escalates-after-repairs/index.md](../attachments/handoff-without-a-first-line-status-escalates-after-repairs/index.md)
