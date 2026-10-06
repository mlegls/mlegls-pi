---
stage: idea
author: session:a4607284-a9a1-451a-8c0e-abe9b8530f5c
---

Tracker `issues.ts check` reports valid heading links as missing when their anchor contains inline code. Seen during [[projects/concept/issues/share-a-hub-patch-release]] refinement on Concept `2b67ba6c`, 2026-10-06: `implement-paid-use-billing-and-subscription-states.md` links to the heading Review (after `584e7f21`) in `redrive-29496fa.md` and Review (after `133272a0`) in `drive-5.md`. Both headings exist verbatim. Check prints the anchors with the code spans replaced by spaces and exits 1.

Owner: tracker `scripts/issues.ts:402-430`. `checkLinks` matches links against `maskMarkdownCode(raw)` and compares the masked anchor with unmasked headings. The masking introduced by [[projects/mlegls-pi/issues/archive/tracker-check-flags-inline-fixture-wikilinks]] correctly ignores literal example links, but also destroys inline-code text inside a live link.

Tried: read the two source links and target headings, then inspect `checkLinks`; this is not a missing target or heading. Workaround for refinement: the issue-tree query validates the new contracts; distinguish these two known false positives from real link findings in the global check. No project evidence links were weakened to silence the tool. A source repair is outside that worker's tracker/stub-only assignment.
