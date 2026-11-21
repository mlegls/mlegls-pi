---
stage: done
assignee: agent:auto-routine
author: "session:thr_vetzcc74ex"
priority: 3
---

A reviewed branch can loop on landing into a busy main. Its fast-forward integration fails whenever main has advanced, and other reconcilers' tracker commits (`tracker: update …`) advance main every few minutes. Each failure sends the branch back for a rebase, plus a pre-integrate run of about 6 minutes, by which time main has moved again. Observed in concept on 2026-10-14: `mission-review-stop-can-outlive-its-due-scope` failed its ff-only landing 3 times (14:00, 14:07, 14:13), and `copy-scoped-charting-session-opens-untitled-with-an-empty-map` and `the-suspect-node-state-is-dead-in-the-application` each failed 2 or more times.

Done when a landing whose only intervening main commits touch tracker files (`docs/issues/**`) lands without another review round-trip, e.g. by rebasing those commits in at integration time and rerunning only the cheap checks; and a concept landing under concurrent reconcilers succeeds on its first or second attempt.

## Result

done. The held-index replay landed after one gate run and preserved both commits. All 14 affected checks passed. No repairs were needed.

```yaml
commit: 9963d0b0
stories:
  - story: A reviewed worker lands through tracker-only main drift without another review round-trip.
    outcome: held
  - story: A Concept landing under concurrent reconcilers succeeds on its first or second attempt.
    outcome: held
evidence:
  path: docs/attachments/landing-loops-while-tracker-commits-advance-main/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - "Concept’s first-attempt landing is historical; the disposable replay establishes index-lock overlap."
  - "A persistent index lock can delay failure by about 30 seconds. Retries wait 250 ms and do not rerun preparation."
```

Evidence: [docs/attachments/landing-loops-while-tracker-commits-advance-main/index.md](../attachments/landing-loops-while-tracker-commits-advance-main/index.md)
