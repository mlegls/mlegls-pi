---
stage: done
assignee: agent
author: session:01a0f1a4-b41c-729b-8734-145d65f93ae6
---

Obsolete 2026-10-01: `ab computer` and its Jev decision driver were deleted in the pi 0.99 rebuild (`4b79baa`). Computer use is the `cua` and `chrome` MCP servers now ([[projects/mlegls-pi/issues/archive/buy-a-computer-use-driver]]).

Concept's independent release-graph drive observed both false positive and false negative completion judgments from `ab computer --browser` against an exclusively owned Playwright/CDP page on the packaged Application, revision `6c5e0d5`.

- Public Hub → Common Concept navigated to its exact release. The combined until “Common Concept Patch document and its Nodes index are visible” waited twenty times and returned stuck; independent DOM/screenshot immediately showed “Nodes in this Patch” and its index. Trace: `2026-09-30T09-30-49-739Z-6c6513.browser.jsonl`.
- With Take a lesson selected, goal “In the selected 'Take a lesson' card, use its Needs chip 'Set a first Mission' to read that dependency” and until “The Set a first Mission criterion is visible” returned done with zero actions. The selected card was still Take a lesson; Set a first Mission was only a Needs chip. Trace: `2026-09-30T09-32-58-165Z-3716e2.browser.jsonl`.
- The next goal explicitly required the selected heading to change and chose the graph Node rather than the requested Unlocks chip. That did change the card, but did not verify chip navigation.

Owner: mlegls-pi computer browser judgment/action choice. Cause unestablished. Workaround: independently inspect the card heading; replay the named chip through Playwright or Chrome CLI; supply an authoritative heading verifier for further intent drives. Observation and screenshots: [[projects/concept/attachments/put-the-release-graph-band-and-a-read-only-node-card-on-every-patch-document/index]]. Raw traces stay in session `01a0f1a4-b41c-729b-8734-145d65f93ae6`.

Proposed improvement: distinguish a selected card heading/criterion from the same Node's dependency chips in completion state. This is not an Application navigation failure.
