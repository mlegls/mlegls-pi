---
stage: ticket
assignee: agent
author: run:run_a99780307abf
---

Extend the native background trial to the actual Electron/custom-control apps.
[Guide and recording](../guide/cua-background.md): the direct Jev runner replaced
a TextEdit document, then finished on Cua verify_state confirming the exact AX
value. Zed remained frontmost at sampled endpoints; this is not a continuous
focus-isolation or general background-compatibility claim.

Observed costs: unfiltered Cua window capture included app menus and used 29,208
Jev input tokens. A native query retained the document/ancestor projection and
reduced the repeat to 982. Query and tree budgets are explicit runner options;
projection cannot establish absence. Native elements_complete remained false.
A prior bold-button press reported an unverifiable effect.

Next measurement: background type/scroll in an Electron app, with frontmost and
cursor sampling during delivery, not only endpoints. Include an interrupted
mutation: no automatic retry or later queued write after cancellation. The
current replay covers transport cancellation/lifecycle, not a live interrupted write.

Origin: Cua-native backend/runner, 2026-09-22, run_a99780307abf;
[computer composition](../computer.md), extensions/exec/cua-runtime.ts,
lib/computer/native.ts. The Playwright controller remains separate so its
locator replay and existing completion policy do not constrain the native API.
