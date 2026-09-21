---
next: grill
priority: 1
---

Five of seven workers in the September 21 concept wave were routed to openai/gpt-5.6-luna and failed with no credits remaining. The coordinator recreated them on ZAI. [Report and source](../research/session-friction-triage-2026-09-21.md).

lib/route.ts accepts caller-supplied usage fractions; lib/pool.ts does not collect availability. Unknown usage stays eligible. A known billing/authentication failure should not be repeatedly selected as if it were unknown quota.

Decide the scope and expiry of provider/account unavailability, who records and clears it, and whether fallback is coordinator-approved or automatic after a positively failed turn. Preserve the distinction between unavailable credentials, exhausted quota, and transient errors. Never retry an ambiguously started prompt merely because routing changed.

Related quota work: [[projects/mlegls-pi/issues/pool-aware-routing]]. Done means a known unavailable account is excluded from subsequent selections and can be deliberately restored, without treating unknown telemetry as failure.
