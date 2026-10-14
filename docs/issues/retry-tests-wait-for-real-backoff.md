---
stage: "ticket"
assignee: "agent"
author: "session:01a13a17-ba44-7373-87c5-ca7eff662862"
---
Done: `bun test` no longer waits for real retry backoff. `lib/reconcile/retry.test.ts` (its trial lives in `docs/attachments/worker-setup-failure-after-admission-escapes-launch-retry/fixture.ts`) runs in well under 30 s instead of ~43 s and still asserts the same retry counts and escalation. Production backoff is unchanged.

Cause (2026-10-14): `lib/retry.ts` has `networkRetryDelay = (attempt) => 15_000 * (attempt + 1)`, and `pendingSetup` in `lib/thread/setup.ts` sleeps that between worker-setup network retries, so the trial's setup half really waits ≥15 s. The restored fake-bb suites made the full `bun test` ~142 s (see [[projects/mlegls-pi/issues/archive/delete-the-zmx-thread-runtime]]).

Shape: let the delay be overridden for tests, e.g. an env var read by `networkRetryDelay` (`PI_NETWORK_RETRY_MS`, set by the fixture) or an injected delay parameter on `pendingSetup`; prefer whichever touches fewer call sites. Check the provider-retry half of the trial for other real waits and shorten those the same way. While there, report any other single test over ~10 s in `bun test` (don't fix them unless it's the same knob).
