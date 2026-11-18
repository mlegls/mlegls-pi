---
stage: "ticket"
assignee: "agent"
author: "session:thr_ihbpyrp6s2"
---
On 2026-11-17 four concept workers finished with a complete YAML handoff but no status word on its first line: disposable-bb-projects-outlive-their-inspection, appearance-advice-repeats-after-its-document-was-offered, gate-card-problem-release-before-strict-activation and card-problem-migration-stops-on-an-unreadable-card-attachment. Twice the status was only inside the YAML (`status: done`) or the first line was the YAML fence. Each one used up both automatic repairs and then escalated to the owner as "status (after 2 repairs)" with an empty body, and the owner only had to ask for a repost. A report whose YAML carries an unambiguous `status:` (or whose shape is plainly a finished handoff: commit plus stories) could be accepted without asking. Failing that, the repair nudge could quote the rejected first line, so the worker can see what was wrong.

These are the four escalations @thread:thr_ihbpyrp6s2#msg=37365, #msg=37920, #msg=39072 and #msg=39796; a plain `retry` cleared three (2026-11-19 efficiency audit, @thread:thr_ivvhpy2bsb).

## tasks

1. Reconciler handoff parsing (`lib/reconcile/`): when the first line carries no status word, accept a report whose YAML block has one unambiguous `status:` value as that status, including a report whose first line is the YAML fence.
2. When a repair is still needed, the nudge quotes the rejected first line.
3. Done when: tests cover a YAML-only status accepted, a fence-first report accepted, and a missing or conflicting status still repaired with the quoted line.
