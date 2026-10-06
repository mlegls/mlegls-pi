---
stage: done
author: session:a4607284-a9a1-451a-8c0e-abe9b8530f5c
---

Tracker `issues.ts check` reports valid heading links as missing when their anchor contains inline code. Seen during [[projects/concept/issues/share-a-hub-patch-release]] refinement on Concept `2b67ba6c`, 2026-10-06: `implement-paid-use-billing-and-subscription-states.md` links to the heading Review (after `584e7f21`) in `redrive-29496fa.md` and Review (after `133272a0`) in `drive-5.md`. Both headings exist verbatim. Check prints the anchors with the code spans replaced by spaces and exits 1.

Owner: tracker `scripts/issues.ts:402-430`. `checkLinks` matches links against `maskMarkdownCode(raw)` and compares the masked anchor with unmasked headings. The masking introduced by [[projects/mlegls-pi/issues/archive/tracker-check-flags-inline-fixture-wikilinks]] correctly ignores literal example links, but also destroys inline-code text inside a live link.

Tried: read the two source links and target headings, then inspect `checkLinks`; this is not a missing target or heading. Workaround for refinement: the issue-tree query validates the new contracts; distinguish these two known false positives from real link findings in the global check. No project evidence links were weakened to silence the tool. A source repair is outside that worker's tracker/stub-only assignment.

## Result

Fixed in `4460a8b` (`skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts`), implemented in a dedicated mlegls-pi worktree for [[projects/concept/issues/archived-issue-links-fail-tracker-validation]]. Live wikilinks retain backticks in their targets, headings and aliases; enclosing code spans and fences still suppress example links.

Before: the two existing Review citations produced false missing-heading diagnostics. After: the owner checkout's `issues.ts check` accepts both unchanged citations. A temporary CLI fixture also accepted inline-code targets/headings/aliases, ignored links inside single/double-backtick spans and backtick/tilde fences, reported a missing live link and preserved code examples during an archive repair. The existing tracker suite passed 22 tests; no permanent tests were added. Setup and the Concept check's separate path/prerequisite repairs are recorded on the linked ticket.

Two-way change; blast radius: tracker. No deployment, browser or authentication required.
