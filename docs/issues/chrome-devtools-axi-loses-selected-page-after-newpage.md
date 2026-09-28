---
stage: idea
author: "session:01a0e7d3-9398-7216-ad8c-0545110f7a77"
---

On 2026-09-28, `chrome-devtools-axi` with the isolated named session `double-buffer-the-rolled-edition-drive` drove a packaged local Common Concept page normally through sign-in, Appearance, reload, screenshot and eval. After `newpage http://127.0.0.1:4410/ncept/?hue=20`, it returned `BROWSER_ERROR: No page is currently selected`. `pages` showed the original and new pages, all `selected:false`; `selectpage 3` returned a snapshot of page 3, yet the next `newpage`, `wait`, `snapshot`, `eval` and `open` each returned the same error. Another `pages` call showed an additional page with `selected:false`. `stop` followed by `open` in the same named session also returned the error, with pages present but none selected. This interrupted the pinned-new-tab encounter. Workaround: used a fresh isolated Playwright browser to finish the observation.

Replay: in a unique named session open an app page, navigate and reload it, then `newpage` to a second URL, `pages`, `selectpage <id>`, `snapshot`. Expected: `newpage` selects its new page and `selectpage` persists to the next invocation, or a clear recovery operation exists. Observed: no selected page and all page-scoped commands refused; root cause unknown.
