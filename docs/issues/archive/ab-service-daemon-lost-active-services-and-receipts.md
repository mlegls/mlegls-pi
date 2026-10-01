---
stage: done
assignee: agent
author: session:01a0f0b7-8f26-7191-a68d-4d4a1748a654
---

Obsolete 2026-10-01: the ab daemon and its `ab mail`/`ab service`/`ab check` commands were deleted in the pi 0.99 rebuild (`4b79baa`). Mail is the `mail` and `board_*` tools now; nothing replaces `ab service` or `ab check` yet.

During the Concept paid-use browser re-drive on 2026-09-30, `ab service start --ttl 5400` launched a packaged Node host and Stripe CLI listener at about 13:13. Both were ready and processed a test-mode invoice payment at 13:18. At about 13:22 the host stopped answering (curl HTTP 000), both service IDs were absent from `ab service list` (which returned `[]`), and neither was listening. Their receipts had specified expiration at about 14:13 and their saved logs showed no application or Stripe error. The daemon's actual exit or restart cause is unknown; no explicit stop was issued before this. Other sessions' earlier service records disappeared too.

Workaround: start a new host service (`f253b3b2-…`) and re-open the browser; this resumed the re-drive. No later Stripe events were attempted with the stale listener secret. Running service receipts should either survive a daemon restart or retain a terminal reason explaining the loss; determine whether daemon lifetime, crash, or environmental teardown caused this encounter. The host and listener logs are under `~/.local/state/ab/executions/` with IDs `d84b5c37-…` and `cdd524bd-…` respectively.

A second encounter (session `01a0f28a-fd13-73f4-ac4e-7f65ac17ee20`, Concept name-things-by-their-names-not-ids drive, 2026-09-30 13:42–13:43 UTC): services `eed4988e-a42b-4621-b24b-87dbb5bb898a` (mise run local) and `f60e588c-93b8-4c6d-bb40-3fb9a4e59ab6` (scripted provider) reported running with a 30-minute expiration, then both disappeared from `ab service list` within two minutes. Their logs had Vite ready on 4409, Convex ready on 3218, and provider ready on 4600; curl subsequently refused all three ports. No stop was issued. Workaround: relaunch both via `ab service start --ttl 7200`. Cause remains unobserved; this is not evidence of a product startup failure.
