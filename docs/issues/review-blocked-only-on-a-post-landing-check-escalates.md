---
stage: "done"
assignee: "agent"
priority: 2
author: "session:thr_ivvhpy2bsb"
---
# Review blocked only on a post-landing check escalates to the owner

Three concept review exceptions between 2026-11-16 and 2026-11-19 had as their only blocker a check that can run only after landing (@thread:thr_ihbpyrp6s2#msg=39367, #msg=40257, #msg=40507). The supervisor accepted every one, and each node stalled until its next turn. Raised by the 2026-11-19 efficiency audit (@thread:thr_ivvhpy2bsb) and agreed by the maintainer the same day.

## tasks

1. When every blocking finding in a review is a check that needs the landed state (verify:main, a staging or production observation, a published-package read), the reconciler accepts the review itself and records each check as a post-landing obligation on the node (its issue and the reconciler log) instead of escalating.
2. A review with any other blocking finding still goes through the existing path.
3. Done when: replays of the three exceptions above integrate without an exception and leave their checks recorded, and a mixed review still escalates.

## Result

done — All three historical scenarios landed using the current `postLanding` handoff. Every pending check appeared in both the issue and the reconciler log. The mixed review escalated without landing. All 18 affected tests passed.

```yaml
commit: 06a87204
fixed:
  - Restricted automatic acceptance to blocking reports. A `done` report with an unobservable story now receives the ordinary `unheld` repair, even if it lists post-landing checks.
stories:
  - {story: "Migration staging dispatch replay lands and records its checks", outcome: held}
  - {story: "Mirror npm publication replay lands and records its check", outcome: held}
  - {story: "Mirror recovery replay lands and records every check", outcome: held}
  - {story: "Mixed review escalates without landing", outcome: held}
evidence:
  path: docs/attachments/review-blocked-only-on-a-post-landing-check-escalates/drive-2.md
  visual: false
  shots: []
tests:
  - lib/reconcile/checks.test.ts
  - lib/reconcile/completion.test.ts
  - lib/reconcile/exceptions.test.ts
  - lib/reconcile/setup.test.ts
filed: []
caveats:
  - Historical findings were replayed in the current structured format. Legacy prose is not automatically classified, and the live staging, npm and mirror checks remain unverified.
```

Evidence: [docs/attachments/review-blocked-only-on-a-post-landing-check-escalates/drive-2.md](../attachments/review-blocked-only-on-a-post-landing-check-escalates/drive-2.md)
