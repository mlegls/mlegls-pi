# Worker setup and provider retry — implementation first use

Independent drive: [predictions, observations and replayable checks](drive.md). All five approved fixture stories held at `fe3340f`; the fresh CLI trial exited 0.

Tested revision: `b5d1438` (the final code and fixture). Offline macOS trial; no model or credentials. Independent driving remains with the supervisor.

Entry point:

```sh
bun docs/attachments/worker-setup-failure-after-admission-escapes-launch-retry/fixture.ts
```

The committed fixture creates an owned temporary Git repository, private board/thread/zmx state and semaphore pool. Setup uses a stub `mise` command through the real admitted runner; provider reports use real reconciler launches with a shell substitute for `pi`. Every run seeds fresh state and stops its workers/reconciler before deleting its target. There is no resident deployment or inherited auth.

Observed:

- Setup failed once with `fetch failed`, logged `retry 1/2 in 15s`, succeeded on attempt two and started the worker.
- Setup failed with `invalid configuration`, exited nonzero after one attempt and never started the worker.
- First generic provider report replaced `generic-implement-1` with `generic-implement-2`, persisted retry count 1, and sent no provider-error owner mail.
- Second generic provider report raised `provider error: provider failed again` and sent one owner notification.
- Authentication report raised `provider error: authentication` on the original handle and sent one owner notification.

The fixture posts the real report shape (`turn-end` plus `error`) and checks the supervisor-role fallback used when its synthetic owner has no subscriber. Early fixture runs timed out because they omitted `turn-end`, then checked only the synthetic mailbox rather than that fallback; both fixture errors were corrected before the final run.

`bun test lib/reconcile/retry.test.ts lib/reconcile/checkpoint.test.ts lib/reconcile/refresh.test.ts lib/thread/admission.test.ts`: 5 pass, 0 fail. `bun run typecheck` passed. The trial covers the ticket's approved cases, not a systematic network/backoff audit.
