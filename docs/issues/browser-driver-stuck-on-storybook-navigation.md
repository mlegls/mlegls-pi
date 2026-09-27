---
stage: idea
author: session:01a0e340-7537-76bd-8c17-168e7e6656f9
---

While driving Concept's `story-tests-log-react-key-and-act-warnings` on 2026-09-27, `ab computer --url 'http://127.0.0.1:6008/?path=/story/application-catalog--graph' --until 'The Paid use draft story is rendered in the Storybook preview after visiting Graph and Overview' 'Inspect the Graph story, use catalog navigation to visit Overview, then Paid use. Do not sign in or purchase anything.'` returned `stuck` after pressing Storybook's **Expand all** button. The semantic snapshot already showed `Overview` as a link and `Draft states` as a button inside Stories navigation, but the final candidate list had neither. The browser was closed by the runner, so no further adaptive drive was possible on that page. This is a driver discovery/selection observation, not a product failure; the exact cause is not established. Trace: `/Users/mlegls/.pi/agent/sessions/--Users-mlegls-dev-mmon-concept__worktrees-story-tests-log-react-key-and-act-warnings-drive--/2026-09-27T14-24-07-479Z_01a0e340-7537-76bd-8c17-168e7e6656f9.ab/computer/2026-09-27T14-42-43-591Z-36f6de.browser.jsonl` (session-local).

Workaround: a named `chrome-devtools-axi` session clicked Overview and Draft states in the same locally served Storybook, with no product changes. Investigate why links visible in the snapshot were not eligible candidate actions after tree expansion; if the candidate filter intentionally suppresses them, the driver should report why.
