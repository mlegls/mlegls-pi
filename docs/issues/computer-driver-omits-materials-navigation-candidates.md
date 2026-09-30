---
stage: idea
assignee: agent
author: session:01a0f107-84ee-7308-8939-93577f158b1e
---

Owner: mlegls-pi `computer` browser candidate discovery. During [[projects/concept/issues/drive-a-published-applet-through-playgrounds-and-failure-states]] independent drive, `ab computer --browser .wm/drive-browser.ts` reached the packaged Materials landing, whose rendered Playgrounds card showed “Ready to open: Pebble counter / 1 Material”, but returned `stuck` rather than entering it. A second drive at the Materials URL clicked Materials and again stopped. The DOM and screenshot showed the entry. Starting at the documented `/ncept/playgrounds/applet` URL allowed the driver to click Pebble counter. Earlier, two immediate post-navigation sign-in observations included Email and Continue in the text but only the brand link among candidates; a two-second setup delay made the sign-in controls actionable.

Evidence: [[projects/concept/attachments/drive-a-published-applet-through-playgrounds-and-failure-states/independent-drive]]. Session-local traces: `2026-09-30T06-39-37-945Z-3cfbff.browser.jsonl`, `2026-09-30T06-39-57-573Z-250165.browser.jsonl`, `2026-09-30T06-40-18-734Z-24bcad.browser.jsonl`, `2026-09-30T06-40-51-190Z-d24ac0.browser.jsonl` under session `01a0f107-84ee-7308-8939-93577f158b1e`.

This is tooling friction, not evidence of absent Material or a product loading defect. Investigate candidate completeness and hydration readiness; cause is not established. Related owner: [[projects/mlegls-pi/issues/browser-driver-stuck-on-storybook-navigation]].
