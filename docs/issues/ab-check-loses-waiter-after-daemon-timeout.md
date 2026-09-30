---
stage: done
assignee: agent
author: session:01a0e959-c271-713d-bda7-a4789d286477
---

During Concept feature-use journal review, `ab check -- bun test packages/core/test/default-event.test.ts packages/core/test/evidence-state.test.ts packages/web/test/server/feature-use.test.ts` returned a queued execution (`3557d41d-7d5e-4103-b27e-5340d4a30756`), then `ab: timed out talking to ab daemon`. `ab check list` subsequently showed it canceled with code 130 and reason `no waiting callers`; no test log existed. Other contemporaneous checks also showed that reason. No daemon was stopped by this reviewer.

Triage, 2026-09-30: the connected check caller should retain its waiter across a transient daemon-request timeout. Recover by execution/client identity without resubmitting the command; intentional caller departure must still release ownership. `ab/resources.ts` currently lets a failed `get` fall through to `finally` and release the client. The underlying daemon delay remains unestablished.

A later `ab check` invocation worked; retrying after inspecting the execution receipt is the workaround. Investigate daemon request timeout / waiter ownership so a connected foreground caller is not silently lost while queued. Owner: mlegls-pi execution queue.

Concept official-publisher review (`01a0e99a-8e5d-712a-b3b6-8c44948a59d3`): `ab check -- bun test` execution `99af69ea-0039-4931-bacb-778a0b5e6897` began running and printed passing tests, then the waiter returned `ab: timed out talking to ab daemon` (exit 2) after 172 seconds. Its saved log contained no terminal suite summary when inspected. Kept the earlier completed affected-test and repository-check results; did not infer a full-suite pass or launch a duplicate full suite.

Concept account-operation review (`01a0e9a2-169f-72f1-9c2f-51bc610e9049`): repository check `a68fbc5e-68ae-45ac-833c-37ca0264c400` and full-suite check `822738dd-9aa2-4085-8149-bf1cb47587d0` lost their waiters with `timed out talking to ab daemon`. The former's saved log ended with SIGTERM during formatting; the latter had no log. Retried through `ab check` after inspecting those artifacts, without stopping the shared daemon.

Concept study-operation review (`01a0e99c-fe29-7383-9aa5-93d249325515`): four queued checks lost their waiters together: repository check `18e5b816-b7c4-4559-9885-680ff3c4a90d`, full suite `5d58ac0f-1923-4516-ba99-9d58bdbfaf79`, size delta `19563e47-98c8-42b0-bd7d-42d30eb45d31`, and advisory lint `17fe1407-080c-4a4e-832f-c3b5bf09682f`. Receipt inspection showed code 130, `no waiting callers`, and no logs for all four. No shared daemon was stopped. A subsequent affected-suite invocation completed (76 pass); the other checks were resubmitted through `ab check`.

On retry, repository check `161cc3d0-ce78-4466-b40a-f7bd9f848d33` reached codegen after format/type/lint/style/design passed, then lost its waiter and was canceled with code 143. Focused test `f5e8ae7a-8de9-4659-b9cc-aff4201b6730` also returned the daemon timeout, but receipt inspection showed code 0: that execution had actually completed. Queued final replay `232ad12b-aea9-4c46-897f-1582de73e173` and commit `b7609489-97a8-4233-b822-1ca4b260c740` were canceled before starting. This makes receipt inspection essential before retrying commands with effects, especially commits.

Concept chess review (`01a0e9ae-af9a-7405-a54b-8bde935fc6b2`): setup `d328c952-047e-497d-92da-c2b811b7b1d2` and affected regressions `1cdc31e1-e1a5-4529-abbd-d3e1552d3062` returned the same daemon timeout. Both receipts later showed code 130, `no waiting callers`, no start time and no log. Retried setup only after confirming cancellation; no shared daemon was stopped. A premature test retry confirmed dependencies were still absent, not a product test failure.

review boundary, 2026-09-30: the ab check pair (ab-check-loses-waiter-after-daemon-timeout, ab-check-list-truncates-machine-readable-json) is reviewed once as a combined delta from `894e8c6` by the root tend session after both integrate. This is a code review of the combined diff; each leaf's own acceptance review (evidence packet against the ticket) still runs.

## Result

[First-use CLI drive and replayable checks](../attachments/ab-check-loses-waiter-after-daemon-timeout/index.md).

## Verification evidence

[Encounter and evidence](../attachments/ab-check-loses-waiter-after-daemon-timeout/index.md).

review, 2026-09-30: combined ab check delta 894e8c6..b336acb (`ab/resources.ts`, `lib/daemon.ts`, help) reviewed by the root tend session; no repairs. Residual: a daemon that never answers again leaves the caller retrying (one stderr line per ~5.5s) until interrupted; the lease expiry is only observed once the daemon responds. Cause of the stalls: [[projects/mlegls-pi/issues/ab-daemon-requests-stall-past-client-timeout]].
