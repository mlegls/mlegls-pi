---
stage: idea
assignee: agent
author: session:01a0f539-ff24-742a-9d77-b1a2a741d0d2
---

Owner: mlegls-pi `computer` browser action candidates. During the independent [[projects/concept/issues/archive/scope-the-materials-pane-to-the-session]] drive on 2026-10-01, `ab computer --browser` tried to fill the closed **Find a Material** combobox with `Customize`. The locator resolved to `<button role="combobox" aria-haspopup="dialog">`, and Playwright refused: `Element is not an <input>, <textarea> or [contenteditable] element`. The run ended stuck at its first action; no mutation was delivered.

Workaround: caller-owned browser lifecycle clicks that rendered combobox button using `getByRole('combobox', {name:'Find a Material', exact:true}).click()` before starting the intent driver. The same search intent then filled **Search Materials** inside the dialog successfully and showed the matching Document. Product click/search worked; no product repair.

Evidence: [[projects/concept/attachments/scope-the-materials-pane-to-the-session/index]]. Session trace `2026-10-01T02-13-47-775Z-d6d2de.browser.jsonl`; successful workaround `2026-10-01T02-14-14-966Z-6621bf.browser.jsonl`, under session `01a0f539-ff24-742a-9d77-b1a2a741d0d2`.

Proposal: distinguish editable and button combobox action candidates; opening a button combobox should remain reachable without proposing an impossible fill.
