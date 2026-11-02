# Independent CLI drive

Tested revision: da7035a984d97968034c7c9b0a57ca2b12b35ed6. Nonvisual CLI journey, 2026-11-02.

## Predictions written before first use
- Editing disposable lib source replaces reconciler and pickup PIDs within approximately one minute and logs restarting: **met**.
- Chain and worker survive without another owner notice: **met**.
- A landing defers restart while status reports stale: **unobserved**, supplied surface has a running implementer, not an in-flight landing.
- Production retired-directory cleanup remains a post-landing obligation: **unobserved**, not this disposable target.

## Setup and encounter
Ran `bun docs/attachments/long-running-reconcilers-keep-pre-change-code/setup.ts`. It returned ready true for owned `/tmp/code-refresh-8bDB3s`, copied package `/tmp/code-refresh-8bDB3s/package`, repo `/tmp/code-refresh-8bDB3s/repo`. Local disposable deployment, fake bb persona `thr_fixture`, seeded solo implementer and paused pickup watcher; no credentials or production services. No inherited deployment reused.

1. Ran `bun docs/attachments/long-running-reconcilers-keep-pre-change-code/setup.ts status /tmp/code-refresh-8bDB3s`. Both statuses showed loaded fingerprint c2a710e00fa087e773e91366be0de239e2429bef0f65153c07b1551816ec7a34 and stale false. Run PID 1330178; watcher 1330234.
2. Added a comment-only new file `package/lib/drive-refresh-marker.ts` in the owned copy. Immediate CLI statuses both showed stale true with the original loaded fingerprint.
3. Waited 70 seconds, then repeated status and inspected runtime state/logs (not implementation). Run PID became 1368509; watcher became 1368412. Both statuses showed stale false and fingerprint 1a5fa626e48f619071173fe1bce117e1e47b09112a99198aa878bbee8e8129c5.
4. Run log: `code changed on disk; restarting`, then `started quietly (budget 1)`. Watcher log also recorded `code changed on disk; restarting`. Restart timestamps were 05:58:14 and 05:58:13, approximately a minute after startup.
5. Same chain `solo`, implement phase, worker `solo-implement-1`, bb `bbt-209091ea`, base d6af747d46d74482a250b24486e0bd85023391ce, launch timestamp 1793599034089 and retry counters persisted. Exceptions remained empty. Fake host call history contained only the original spawn and original owner tell, and no stop/archive calls. Owner's tells remained exactly `[reconcile solo] started (budget 1)`.
6. Ran committed `setup.ts stop /tmp/code-refresh-8bDB3s`; fixture removed and owned services stopped.

## Replayable checks and limits
- Repeat setup, status, add comment-only lib file, immediate status, wait 70 seconds, status: accept old fingerprint/stale true followed by new fingerprint/stale false, new PIDs, restart log lines.
- Compare runtime chains before/after and fake-bb calls/owner tells: accept unchanged worker/base/launch/retry data, no additional spawn/stop/archive/tell. Held here.
- Landing deferral and recovery still require a prepared pending landing through the public workflow; this setup exposes only an indefinitely running fake implementer. No state injection or source reading used to simulate acceptance. **Unobservable** here, owned by the original ticket and its reviewer, not waived.
- Historical completed landing receipts and nonempty exceptions were not present in this fixture; preservation under those conditions is not established.
- Production retired-directory uniqueness audit/removal remains on the original ticket after landing. No production data touched.

## Frictions
No product friction observed in exercised CLI journey. Setup's implement-only starting state does not provide the landing required for the remaining acceptance check. This is an evidence/setup gap, not a product failure. Reviewer must supply that state before acceptance.

## Review (2026-11-02)

Read the diff with this log. Two repairs:

1. **Restart deferral was too broad.** The run deferred its restart for any landing receipt without `cleanupDone`. `landReviewed` writes the receipt before integrating and leaves it when a gate or ff-only merge fails, so a run holding an "integration failed" exception could not refresh onto the code that fixes it, the case the ticket was filed for. Integrate and rebase are awaited inside `tick`, so none runs at the check. The check now defers only for a landed node whose cleanup is unfinished (the idiom at `reconcile.ts` 1594/1623). A merge that reached its target but wasn't recorded is recovered by `recoverLandings` at the next start.
2. **Watcher rescanned every minute.** The refresh check rode on a `setInterval(tick, 60 s)` that ran the whole tracker scan. It is now its own `refresh` interval (15 s, rate-limited to a disk hash per minute by `CodeMonitor`), also independent of scan failures.

Re-drove on this head with the committed setup: fixture `/tmp/code-refresh-a1Hia1`; added `lib/review-marker.ts`; the status showed `stale: true`, and after a minute both processes restarted (run log "code changed on disk; restarting" then "started quietly"; watcher likewise), same chain `solo`/`solo-implement-1`/`bbt-f21ac845`, `stale: false` with the new fingerprint. Stopped and removed through `setup.ts stop`.

Not observed: the deferral itself. With integrate awaited in-tick, a landed-but-uncleaned receipt is cleaned on the same or next tick, so it is a window of seconds that this fixture can't hold open; the check is one predicate. Not done here: the `concept__retired` audit and removal, and bootstrapping the pre-change processes (the ticket sequences both after landing).
