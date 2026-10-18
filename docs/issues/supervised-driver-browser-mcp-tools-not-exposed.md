---
stage: idea
assignee: agent
priority: 2
author: session:eb958496-f6ec-4ef0-9bdc-7ceea6a866bb
---
During Common Concept's independent Hub drives, the assignment required `mcp__chrome__*` browser control through codemode, but `searchTools("chrome")`, `searchTools("mcp__chrome")`, and filtering `ALL_TOOLS` for `chrome` returned no tools. Packaged setup succeeded; the browser encounter could not begin. A replacement worker reproduced it; on 2026-10-06 the supervisor confirmed host-wide absence and authorized chrome-devtools-axi or Playwright as a fallback.

Owner: worker/browser tool provisioning at the pi harness boundary; no implementation cause established. Check the installed pi MCP configuration and worker exposure before adding harness-specific provisioning. Preserve a private browser and the required journey; CLI-only receipts are not a substitute. Workaround: explicitly authorized AXI/Playwright control.

Evidence: [[projects/concept/attachments/hub-yours-empty-heading-says-published-on-working-revisions/index]] and [[projects/concept/attachments/unlisted-hub-patches/independent-drive]]. Moved from [[projects/concept/issues/supervised-driver-browser-mcp-tools-not-exposed]] during development-friction gardening.

2026-10-18 recurrence: `match-missions-map-and-phone-composition-to-the-approved-frames-drive-32` had no Chrome tools in ALL_TOOLS/searchTools. Cua tools were available, and a driver-owned isolated Chrome was launched and exactly bound. This permitted semantic reads/screenshots and explicit synthetic DOM clicks with readback, but not the required emulated viewport/dark preference or keyboard-focus acceptance: native geometry clamped requested 390px to 485px content and height to 862px. Trusted browser click/scroll refused `browser_input_trust_unavailable`; background native Escape left inspection unchanged. Legacy execute_javascript refused `unbounded_operation_requires_unrestricted`; no permission changes attempted. Thus partial functional observations are not the native-size acceptance matrix. Evidence: [[projects/concept/attachments/match-missions-map-and-phone-composition-to-the-approved-frames/drive]].
