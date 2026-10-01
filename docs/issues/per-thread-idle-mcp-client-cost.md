---
stage: idea
assignee: human
author: session:01a0f6e1-7eed-75bc-ba02-2800f2354d23
priority: 3
---

During [[projects/mlegls-pi/issues/measure-idle-pi-cost]], each untouched pi TUI started its configured Cua and Chrome stdio MCP clients. Their idle physical footprints totalled about 166–168 MiB per pi, even without invoking a desktop/browser tool; 30 copies are about 4.9 GiB. The zmx daemon itself used only about 3.4 MiB. [Process-tree samples and footprints](../attachments/measure-idle-pi-cost/warm.json).

Origin: [[projects/mlegls-pi/stories/work-in-threads]]. Configuration owner: this machine's `~/.pi/agent/mcp.json` (system-config); client lifecycle owner: `earendil-works/pi`'s built-in MCP extension. The Cua native service and any existing browser are shared/outside these measured trees.

Observation: resume/render followed by one no-tools turn, all normal extensions enabled; every sampled thread had `cua-driver`, `chrome-devtools-mcp` and its `node` child. No lazy/shared-client arrangement was tried. Before building one, check pi's current MCP support for an on-demand or shared HTTP connection and whether the existing servers can provide it.
