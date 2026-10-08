---
stage: idea
assignee: agent
priority: 2
author: session:eb958496-f6ec-4ef0-9bdc-7ceea6a866bb
---

During Common Concept's independent Hub drives, the assignment required `mcp__chrome__*` browser control through codemode, but `searchTools("chrome")`, `searchTools("mcp__chrome")`, and filtering `ALL_TOOLS` for `chrome` returned no tools. Packaged setup succeeded; the browser encounter could not begin. A replacement worker reproduced it; on 2026-10-06 the supervisor confirmed host-wide absence and authorized chrome-devtools-axi or Playwright as a fallback.

Owner: worker/browser tool provisioning at the pi harness boundary; no implementation cause established. Check the installed pi MCP configuration and worker exposure before adding harness-specific provisioning. Preserve a private browser and the required journey; CLI-only receipts are not a substitute. Workaround: explicitly authorized AXI/Playwright control.

Evidence: [[projects/concept/attachments/hub-yours-empty-heading-says-published-on-working-revisions/index]] and [[projects/concept/attachments/unlisted-hub-patches/independent-drive]]. Moved from [[projects/concept/issues/supervised-driver-browser-mcp-tools-not-exposed]] during development-friction gardening.
