---
stage: idea
author: session:2026-09-26T09-29-46-063Z_01a0dd0c-9b4f-7795-aad1-0299963801cf
---

During Concept's humanize-identifiers verification, the browser driver supplied a verification code to the Email textbox. The final semantic snapshot shows Email containing `424242` and the Continue button labelled “Sending code…”. Both Email and Verification code inputs were available as candidate actions for that textbox; the driver chose the wrong one. This is not missing Playwright or an input parser failure.

Source: session `01a0dcd4-0439-7190-9c55-0aa636998bd6`, sibling `.ab/computer/2026-09-26T08-33-16-576Z-33a975.browser.jsonl`. The controller enumerates every supplied input for every editable field in `lib/computer/browser-runner.ts`. Do not assume field-label matching is a sufficient remedy: field names and supplied-input names need not match. Existing project authentication via `--browser` can avoid replaying sign-in for unrelated product verification; it does not fix arbitrary form driving.

Impact observed: failed sign-in drive. No live reproduction or general reliability estimate yet. [Recovery review](../research/session-friction-review-2026-09-26.md).
