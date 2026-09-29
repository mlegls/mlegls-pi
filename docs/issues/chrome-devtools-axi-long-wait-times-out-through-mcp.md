---
stage: idea
author: session:2026-09-29T13-43-55-064Z_01a0ed68-5db8-7724-9b19-b2e0b24ba723
priority: 4
---

During an independent rendered applet-query restart drive in Common Concept on 2026-09-29, `CHROME_DEVTOOLS_AXI_SESSION=settle-applet-query-host-call-on-backend-loss-drive chrome-devtools-axi wait 60000` returned `MCP error -32001: Request timed out` after roughly a minute. The page remained available and a fresh `snapshot` worked; four successive `wait 20000` calls completed and allowed the same journey to finish. No browser state was lost.

Workaround: bound each CLI wait below the bridge/MCP request deadline. Consider documenting/enforcing the effective ceiling or implementing longer waits without one long MCP call; the session did not establish which layer owns the limit.
