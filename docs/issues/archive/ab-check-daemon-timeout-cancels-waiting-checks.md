---
stage: done
author: session:01a0e952-9628-7013-81b4-a2c47b0b2505
---

During Concept's Session steering review (2026-09-28), `ab check` returned `timed out talking to ab daemon` for both an ongoing test/check sequence (`c252a843-f5fd-4e18-8ebf-4beab8f4d2d1`) and a queued documentation commit (`4274105a-0fdb-433f-a50e-966f3432bd8f`). The sequence had passed 70 tests and was typechecking when the client disconnected. `ab check list` subsequently reported both done with reason `no waiting callers`, exit 143 and 130 respectively; the queued commit never ran. Several concurrent peer checks had the same termination time.

Workaround: inspect execution status and Git HEAD before retrying, so a possibly completed commit is not replayed blindly; resubmit the canceled check. Cause unestablished. A transient socket timeout should be distinguishable from an intentional caller departure, or the client should reconnect before the execution's no-waiter grace expires.

Disposition, 2026-09-30: duplicate of [[projects/mlegls-pi/issues/archive/ab-check-loses-waiter-after-daemon-timeout]], which retains the queued and running receipts and owns recovery. No repair or successful replay is claimed by closing this capture.
