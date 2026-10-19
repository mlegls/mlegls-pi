# Independent CLI encounter

## Predictions before opening the product

- Owned live child completion: supervisor produces a short local reply, settles idle without errors or provider traffic; child remains idle and linked to parent.
- Ordinary child completion: supervisor makes a real provider request.
- Reconciler-style tell: reaches real provider, whose context excludes the previously swallowed notice and local reply.
- Plugin removal is not observable through this user surface; review must establish it.

Setup: committed prepare entry point; isolated checkout-owned fixture under `.wm`, seeded ownership and live liveness process, existing local BB/Pi authentication. No actual reconciler execution. Runtime expected BB 0.46.1 / Pi 1.2.0. No UI journey.

## Observed encounter (2026-10-19)

Revision `85156cb06c00b2facd8c9f3d35f577ebbc996cb0`; BB CLI reports 0.46.1. Prepare printed readiness for checkout-owned `.wm/reconciler-notice-9RctQz`. Created disposable project `proj_hpmhzxxvys`, environment `env_cfm43p2pyz` (ready, exact fixture path), parent `thr_cpdz8ke7t2`, Pi session `pi_0ff4b5d7-67c7-4037-9e3c-0451d065708d`.

Used the index's reproduce commands, substituting these IDs. Spawned scheduled child `thr_2af884iubn`, seeded it through setup.ts, released queue message `qmsg_zapcgvypr4`, and waited for child idle. Child idle initially preceded parent notice: inspected log again before proceeding, rather than treating idle as notice delivery.

| Prediction / story | Outcome and observation |
| --- | --- |
| Owned completion settles locally | Met / held. Parent log seq 21 child-completed request, 23 normal turn start, 32 reply `Worker completion noted.`, 33 last token usage all zero, 34 completed. No error surfaced. Parent show idle, zero queued messages. |
| Child status and parent preserved | Met / held. Child show idle, parentThreadId `thr_cpdz8ke7t2`. |
| No provider call on owned notice | Met / held. Fixture request probe had only initial parent request at 1792385220970 and child request at 1792385233487 until the later tell. No parent request at local completion 1792385237339. |
| Tell reaches provider without notice/reply context | Met / held. Sent documented reconciler-style tell; parent request at 1792385243393 had ownedNotice=false, localReply=false, completionNotice=false. RECEIVED at seq 41, completed 43. |
| Ordinary child remains pass-through | Met / held. Unseeded child `thr_ag7jp9bknu`, title reconciler-looking-unowned. Parent notice seq 44; real parent request 1792385253132 had completionNotice=true, ownedNotice=false, localReply=false; RECEIVED seq 50, nonzero usage 51, completed 52. Parent idle afterward. |
| Plugin deletion and future handled comment | Unobservable through CLI persona; source review required, not a live behavioral claim. |

The request probe is supplied instrumentation, not independent network capture. Ownership is seeded and the tell uses reconciler transport/payload rather than a running full reconciliation. These are the committed setup's declared boundaries, not inferred production coverage.

## Replayable checks and expectations formed during use

1. After child idle, require actual child-completed log request plus parent turn/completed before sending the next tell. Expectation met; child idle alone is insufficient.
2. Inspect requests.jsonl around owned completion: accept no new parent provider record, zero-token local turn, idle parent and preserved child parentThreadId.
3. Send the documented tell after local completion. Accept a new provider record with all three contamination flags false and a completed real reply.
4. Spawn an unseeded child on the same environment/parent, even with a reconciler-looking title. Accept completionNotice=true on the real parent request and normal settlement.

Frictions: no new unresolved product/tooling friction. The documented child-idle/notice-delivery race was visible but the provided log inspection procedure resolved it.

Cleanup: disposable project deletion returned ok; prepare process terminated via its owned process handle. No services or external resources left running. No product code, tests or fixtures inspected; no repository checks run.

