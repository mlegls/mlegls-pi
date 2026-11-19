---
stage: "ticket"
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
