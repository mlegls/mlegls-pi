---
stage: done
author: session:2026-09-26T09-29-46-063Z_01a0dd0c-9b4f-7795-aad1-0299963801cf
---

September 26 Concept verifiers report that `ab computer` cannot resolve Playwright from the monorepo root but works from `packages/web`. Several first attempts also omit required `--until`; `agents/verify.md` advertises only `ab computer "INTENT"`. Retries stall on sign-in or end-state verification; some workers switch to chrome-devtools-axi, others end blocked.

Resolved by retaining package-owned Playwright resolution and making that contract explicit in the missing-dependency error, CLI help and verifier stance. The stance now gives required scope and `--until`, separates semantic driving from visual/layout judgment, and requires worktree-owned setup. No dependency installation, child-workspace search or model-routing change.

Original tool output confirms the composer verifier signed in and reached the Session, then exhausted waits on a geometry-based end condition (session `01a0dcbc-dc5e-7628-92a8-b435bf335fb9`, JSONL 75–81). A separate sign-in attempt selected the code for the Email field; that remains owned by [the driver input-selection idea](browser-driver-selects-code-for-email-field.md). Connection refusal and missing Clerk configuration in subsequent attempts are project setup failures, not dependency-resolution evidence.

Verification: existing `ab/computer.test.ts` suite passed (5 tests); root invocation produced the new package-specific diagnostic; `openBrowser` from Concept's `packages/web` opened an isolated Chromium page on a disposable local server and returned its “Browser ready” heading through `ariaSnapshotJSON`. Browser and server were closed. This checks startup, not live sign-in reliability or worker adoption.

[Session evidence and dispositions](../research/session-friction-review-2026-09-26.md).
