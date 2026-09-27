---
stage: idea
author: session:01a0e1f9-7532-7020-9cfb-1028c0d6c727
---

During [[projects/mlegls-pi/issues/supervise-detects-unstarted-workers]], `bun-axi test lib` failed `lib/session-meta/index.test.ts`'s “records one entry at session start”: the expected metadata omitted `parentSession`, but the actual entry inherited `PI_WM_PARENT_SESSION` from this worker environment. The test's `withEnv` clears `PI_WM_RUN`, `PI_WM_HANDLE`, `PI_WM_AGENT` and `PI_SESSION_ID`, but leaves that variable untouched. Running the focused test with `env -u PI_WM_PARENT_SESSION` passed. The full library test run otherwise had 150 passes, 2 skips, and the five terminal-session failures tracked in [[projects/mlegls-pi/issues/session-terminal-regressions-fail-with-extra-shell-sessions]].
