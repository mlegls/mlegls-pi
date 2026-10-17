---
stage: "idea"
assignee: "agent"
author: "session:01a14a2d-2239-773d-85a4-773c1b45ab3d"
---
Observed while driving concept's build-the-standard-flow-and-islands-system catalogue. chrome MCP `take_screenshot` with `fullPage:true` and `format:webp` reported success but wrote a zero-byte file for a very tall (~21,000px) Storybook page. A later `ls` showed 0B. Viewport WebP captures worked and were used instead. No raw failed artifact was kept.

Owning tool: chrome-devtools-axi MCP screenshot. Repro: open any ~21,000px-tall page, request a full-page WebP, then check the file size. Not diagnosed: it may be a browser texture limit, a WebP dimension limit (16383px) or an unhandled encode error; a success report with an empty file is the defect either way. Proposed: report the failure, or fall back to PNG / refuse above the encoder's limit.

Moved from concept's tracker (chrome-full-page-webp-reports-success-with-empty-file, author session:01a14a2d-2239-773d-85a4-773c1b45ab3d).
