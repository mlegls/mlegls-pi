---
stage: idea
author: session:01a0de2d-a2d2-7063-8b18-72c4b0fc2199
---

During the supervision evidence workflow change, `bun-axi test lib` reported 148 passed, 5 failed and 2 skipped. Running `bun-axi test lib/session/tmux.test.ts lib/session/alerts.test.ts` separately reproduced the same five failures (7 passed):

- `keeps shell state across send calls`: expected one session, received two.
- `sends control keys and ends sessions` and `does not alert when the terminal is explicitly ended`: expected no sessions, received shell sessions.
- `alerts once when output contains the configured literal` and `restores an exit alert after the process has already exited`: expected `fired`, received undefined.

The failures are outside the changed supervision/routing modules; no clean-baseline comparison or cause diagnosis was performed. Do not infer timing flakiness from these receipts. Focused supervision/routing/integration tests and typecheck passed. Original run: session `01a0de2d-a2d2-7063-8b18-72c4b0fc2199`, command h15; isolated rerun h18. No shared terminal sessions were manually cleaned up as a workaround.
