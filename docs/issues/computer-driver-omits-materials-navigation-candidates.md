---
stage: idea
assignee: agent
author: session:01a0f107-84ee-7308-8939-93577f158b1e
---

Owner: mlegls-pi `computer` browser candidate discovery. During [[projects/concept/issues/drive-a-published-applet-through-playgrounds-and-failure-states]] independent drive, `ab computer --browser .wm/drive-browser.ts` reached the packaged Materials landing, whose rendered Playgrounds card showed “Ready to open: Pebble counter / 1 Material”, but returned `stuck` rather than entering it. A second drive at the Materials URL clicked Materials and again stopped. The DOM and screenshot showed the entry. Starting at the documented `/ncept/playgrounds/applet` URL allowed the driver to click Pebble counter. Earlier, two immediate post-navigation sign-in observations included Email and Continue in the text but only the brand link among candidates; a two-second setup delay made the sign-in controls actionable.

Evidence: [[projects/concept/attachments/drive-a-published-applet-through-playgrounds-and-failure-states/independent-drive]]. Session-local traces: `2026-09-30T06-39-37-945Z-3cfbff.browser.jsonl`, `2026-09-30T06-39-57-573Z-250165.browser.jsonl`, `2026-09-30T06-40-18-734Z-24bcad.browser.jsonl`, `2026-09-30T06-40-51-190Z-d24ac0.browser.jsonl` under session `01a0f107-84ee-7308-8939-93577f158b1e`.

This is tooling friction, not evidence of absent Material or a product loading defect. Investigate candidate completeness and hydration readiness; cause is not established. Related owner: [[projects/mlegls-pi/issues/browser-driver-stuck-on-storybook-navigation]].

Recurrence during [[projects/concept/issues/gather-the-patch-owners-tools-into-one-workbench]] first use (session `01a0f1a3-c8a7-72ad-bcdb-e8afce9c6224`, 2026-09-30): initial `ab computer --browser` at packaged sign-in returned `needs-input`, zero actions. Its text snapshot contained Email and Continue with email, but the outline/candidates only contained the brand link. Waiting for body text and one second after navigation let the same intent sign in successfully in four actions. Traces `2026-09-30T09-30-31-039Z-cf1183.browser.jsonl` and `2026-09-30T09-31-17-005Z-c7d6dc.browser.jsonl` in that session's computer directory. The workaround is readiness in the caller's browser setup; the exact race remains undiagnosed.

The same workbench drive also stopped at the rendered `Versions · 2` disclosure with zero actions (`2026-09-30T09-44-03-025Z-27b775.browser.jsonl`). Its candidates contained no Versions action. The worker-owned DevTools snapshot exposed a `DisclosureTriangle`; clicking it revealed exact 1.0.0 and 1.1.0 links, and 1.0.0 navigation succeeded. This is another candidate-coverage observation, not missing product navigation. Evidence: [[projects/concept/attachments/gather-the-patch-owners-tools-into-one-workbench/drive]], old-release encounter.
