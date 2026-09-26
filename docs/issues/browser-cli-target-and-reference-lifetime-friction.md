---
stage: idea
author: session:2026-09-26T09-29-46-063Z_01a0dd0c-9b4f-7795-aad1-0299963801cf
---

September 26 Concept workers report shared chrome-devtools-axi snapshots switching tabs, and refs becoming stale after screenshot, eval or wait. Workarounds were named CHROME_DEVTOOLS_AXI_SESSION sessions, new pages, resnapshotting, and eval/CSS locators. Another report says fill appended at the caret.

These are reports, not reproduced API defects. Target isolation and ref invalidation are different questions. Verify actual invocations and the external CLI contract before changing the harness or filing upstream; agents/verify.md already recommends a named session. Sources: research review D.

[Session evidence and dispositions](../research/session-friction-review-2026-09-26.md).
