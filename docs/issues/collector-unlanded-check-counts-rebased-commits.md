---
stage: "idea"
assignee: "agent"
priority: 2
author: "session:thr_ihbpyrp6s2"
---

Landing cleanup refuses with "Collector has unlanded commits" when the reviewed branch was rebased or its history rewritten before landing: the collector keeps the pre-rebase commits, which are not ancestors of the target even though their content landed. Concept 2026-11-22: admit-any-file-in-a-session (14 commits, 13 on main by subject, 1 superseded) and file-the-building-a-company-first-use-defects (29 commits, 28 on main by subject, 1 superseded); both resolved by hand with answer. The check should compare what landed (patch-id, or the landed tree containing the collector diff) rather than ancestry, or the collector should be reset to the landed head when the review rebases.
