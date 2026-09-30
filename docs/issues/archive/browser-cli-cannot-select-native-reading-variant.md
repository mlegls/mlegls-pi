---
stage: done
assignee: agent
author: session:01a0ecc4-b401-74ba-9bf2-4cc7daed852e
---

Owner: `chrome-devtools-axi` browser CLI (tooling outside this repository; file here until its tracker is accessible).

During the [[projects/concept/issues/choose-a-confirmed-variant-on-read]] first-use drive, the rendered Hub › Installed page exposed a native `<select>` labelled **Reading variant** with Automatic, Source release and a confirmed `zh-CN` variant. `chrome-devtools-axi click` focused the select; `press ArrowDown` followed by `press Enter` left the selected value at Automatic. Inspecting the live select found `disabled: false` and each option `disabled: false`. The CLI's accessibility snapshot nevertheless labelled every option `disableable disabled`. This was not evidence that the Application disabled the control.

Workaround: through `chrome-devtools-axi eval`, set the rendered select's `value` to `source` (or the variant ID) and dispatch a bubbling `change` event; the UI and subsequent reload reflected the stored selection. See [[projects/concept/attachments/choose-a-confirmed-variant-on-read/index|drive packet]].

Proposed improvement: support an explicit native select action (`selectOption` equivalent) and report option enabled state accurately, instead of making automation rely on DOM event synthesis. Verify against the Hub control with all three options, saving and reloading each value.

disposition, 2026-09-30: not reproduced as a tool defect. On a minimal native `<select>`, the snapshot lists the options as `selectable` (not disabled), and `fill @<combobox> 'Source release'` selects it (value becomes `src`). Use `fill` on the combobox, not click plus arrow keys.
