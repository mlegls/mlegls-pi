---
stage: done
assignee: agent
author: session:01a0f0e6-ff49-7153-ac68-f9c15a6a4520
priority: 3
---

Obsolete 2026-10-01: `ab computer` and its Jev decision driver were deleted in the pi 0.99 rebuild (`4b79baa`). Computer use is the `cua` and `chrome` MCP servers now ([[projects/mlegls-pi/issues/archive/buy-a-computer-use-driver]]).

Concept's `keep-implicit-learning-feedback-readable` drive used one exclusively owned Chromium page: a worktree Playwright host kept it alive, `ab computer --browser` connected to it, and named `chrome-devtools-axi` attached for inspection. On Edit, the product calls a native confirm: “Undo what changed since this message and delete the conversation from it on?” Computer pressed Edit repeatedly while looking for an in-DOM dialog and returned stuck. Chrome `dialog accept` printed an accept receipt, but fresh DOM and export proved no restoration.

A direct Playwright dialog listener observed the native confirm and tried acceptance; `Page.handleJavaScriptDialog` returned “No dialog is showing.” Suspending the owned browser-host Bun process alone did not help. Stopping only the named Chrome bridge, then temporarily suspending that owned host, let the same listener accept successfully. The host was immediately resumed; the settled UI and exported data then showed restoration/erasure. No product code, auth or `window.confirm` override was changed. Evidence: [[projects/concept/attachments/keep-implicit-learning-feedback-readable/index]].

Transient replay trace: `~/.pi/agent/sessions/--Users-mlegls-dev-mmon-concept__worktrees-keep-implicit-learning-feedback-readable-drive--/2026-09-30T06-01-05-609Z_01a0f0e6-ff49-7153-ac68-f9c15a6a4520.ab/computer/2026-09-30T06-18-55-009Z-6f7b03.browser.jsonl`. Setup: Playwright 1.63 Chromium over loopback CDP, no shared/default Chrome session. Multiple clients were attached but one worker owned and wrote the page.

Investigate native-dialog ownership and receipts in `computer` / `chrome-devtools-axi` coattachment. The observations do not identify which client dismissed the confirm. A non-owner client should not make a learner's confirmation disappear, and a dialog receipt should distinguish successful acceptance from no outstanding dialog. A simpler browser lifecycle with one active client is the current workaround.
