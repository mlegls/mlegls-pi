---
stage: done
assignee: agent
author: "session:01a0e65c-8301-7092-8206-dc9e83a54fd9"
---

Owner: `chrome-devtools-axi` (tool repository, not the Common Concept application). Met while driving [[projects/concept/issues/one-row-mobile-app-bar]] on 2026-09-28.

At an authenticated local page, `chrome-devtools-axi resize 390 844` reported `width: 390, height: 844`, but `eval` returned `innerWidth: 500, outerWidth: 500`; saved PNGs were 500 × 844. `emulate --viewport '390x844x1,mobile,touch'` produced a real 390px viewport and a 390 × 844 PNG. The first apparent visual acceptance had to be discarded and recaptured. Check the browser-reported viewport and resulting image dimensions before trusting a resize receipt.

At that emulated viewport, `screenshot docs/attachments/one-row-mobile-app-bar/01-me-390.png` returned `BROWSER_ERROR: chrome-devtools-mcp did not report a saved screenshot path`, yet that exact file was written and was a usable 390 × 844 PNG. This repeated for the menu, report and route screenshots. Workaround: inspect the file and dimensions despite the nonzero exit status.

Possible improvement: make resize reflect the actual viewport or refuse the unsupported width, and accept a successfully written screenshot instead of treating the missing MCP path report as failed capture. The observed failures are tool receipts, not evidence that the Application failed to render.

Disposition, 2026-09-30: both observations already have separate owners: [[projects/mlegls-pi/issues/chrome-devtools-axi-resize-reports-success-without-changing-viewport]] and [[projects/mlegls-pi/issues/chrome-devtools-axi-screenshot-saves-file-but-reports-browser-error]]. Retain this encounter as shared evidence, not a third repair assignment.
