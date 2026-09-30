---
stage: idea
assignee: agent
author: session:01a0f0b7-8f26-7191-a68d-4d4a1748a654
---

During the Concept paid-use browser re-drive on 2026-09-30, `ab service start --ttl 5400` launched a packaged Node host and Stripe CLI listener at about 13:13. Both were ready and processed a test-mode invoice payment at 13:18. At about 13:22 the host stopped answering (curl HTTP 000), both service IDs were absent from `ab service list` (which returned `[]`), and neither was listening. Their receipts had specified expiration at about 14:13 and their saved logs showed no application or Stripe error. The daemon's actual exit or restart cause is unknown; no explicit stop was issued before this. Other sessions' earlier service records disappeared too.

Workaround: start a new host service (`f253b3b2-…`) and re-open the browser; this resumed the re-drive. No later Stripe events were attempted with the stale listener secret. Running service receipts should either survive a daemon restart or retain a terminal reason explaining the loss; determine whether daemon lifetime, crash, or environmental teardown caused this encounter. The host and listener logs are under `~/.local/state/ab/executions/` with IDs `d84b5c37-…` and `cdd524bd-…` respectively.
