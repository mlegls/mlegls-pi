---
stage: "done"
assignee: "agent"
author: "session:thr_wqjd4uttrr"
priority: 2
---
Observed 2026-10-30 by the adversarial review (@thread:thr_wqjd4uttrr). 62236427 (2026-10-29 23:16) made retirement discard a worker's ignored state, with no `__retired` directory, `RETIRED.md` or `wm.disposable` (maintainer, @thread:thr_2t36fi5c4u#msg=653). After it landed, `~/dev/mmon/concept__retired` still gained twelve directories with `RETIRED.md` and `retirement.json`. The latest is `verify-default-runtime-tutor-startup-and-writer-recovery-implement-o` at 10-30 03:20, holding `.wm/capture-production-startup.ts`. The directory holds 4.0 G.

Cause (from `ps`): reconcilers started before the commit keep running the code they loaded. These are `lib/reconcile/main.ts run` for move-the-scheduled-tutor-writer-to-the-default-runtime (10-29 21:06), read-first-map-time-from-production-timings, author-and-publish-the-language-learning-template and compare-gateway-spend-with-the-ledger-after-a-week (10-29 21:39), align-button-variants-with-the-action-set-ranks (10-28) and replay-the-timed-cadence-prepare-practice-continuation (10-26). The pickup watcher has run since 10-26 07:08. A change to retirement, landing or scheduling code doesn't reach a run until someone restarts it, and nothing says when that's needed.

Expected: a running reconciler or watcher notices that the package code it loaded has changed on main. It then either restarts itself at a safe point between ticks or reports that it's stale through `reconcile_status` and `pickup_status`. The existing `concept__retired` directories are then removed once each is checked for files that exist nowhere else.

Efficiency audit 2026-11-02 (@thread:thr_ae8q9yrxnv; auditor @thread:thr_jzyk5zr226): the retirement-notice fix ([[projects/mlegls-pi/issues/retirement-notices-and-retired-checkouts-pile-up]]) landed 10-26, yet the concept supervisor still answered about 86 old-style "retired … kept" notices until 10-29 15:16Z, because reconcilers started before it kept the old code: about three days and roughly $15 of supervisor turns. Five "integration failed 3 times (ff-only)" exceptions on 10-28 and 10-29 likewise stopped only once runs picked up 9f27fe3e.

decisions:
- 2026-11-02: maintainer approved moving this to ready ("ok", @thread:thr_ae8q9yrxnv, on the efficiency audit's proposal). Expected behaviour: restart itself at a safe point.

## shape

A run and the pickup watcher fingerprint the package code they loaded at start, check it between ticks, and re-exec themselves when it changed on disk. State already resumes from `<stateDir>/<root>.json` (session start resumes dead runs the same way), so the replacement picks up chains, exceptions and workers without retiring anything.

- **Fingerprint** (new `lib/reconcile/code-version.ts`): hash of the package's `lib/` and `extensions/supervision/` source files (content, not mtime; `git hash-object` or Bun's hasher over the sorted file list), taken once at process start. `changed()` recomputes it, at most once a minute.
- **Reconciler** (`reconcile.ts` main loop, after a tick that returned false, before `Bun.sleep(TICK_MS)`): if `changed()` and no landing operation is mid-flight (`landingOps` empty, no integrate or rebase running), `note("code changed on disk; restarting")`, save state, spawn the same command line the way `main.ts start` does (detached setsid, same log fd, `--quiet` so the owner gets no new "started" message), publish the child pid in state, and exit. Factor `start()`'s spawn into a helper both use.
- **Pickup watcher** (`pickup.ts` `watch` tick): same check; on change, spawn `pickup.ts watch` detached, record the new watcher pid, and exit.
- **Status**: `reconcile_status` and `pickup_status` show each process's loaded fingerprint and `stale: true` when it differs from disk (the case where the restart is deferred by an in-flight landing).
- **Leftovers**: once this lands, check each existing `~/dev/mmon/concept__retired` directory for files that exist nowhere else (report them), then remove the directories.

Out: hot-reloading modules in-process; restarting mid-landing.

Acceptance: a test starts a run on a fixture package, edits a file under `lib/`, and sees the run log "restarting" and a new pid that resumes the same chains with no worker retired and no owner message; the same for the pickup watcher; status shows `stale` while a landing defers the restart.

## Result

done — stories 1–4 held; story 5 is unobservable by design and accepted by the owner. It is post-landing work for the owner thread (thr_ae8q9yrxnv).

```yaml
commit: review head on branch long-running-reconcilers-keep-pre-change-code-review-3
stories:
  - story: Reconciler notices changed package code and restarts quietly preserving its worker
    outcome: held
  - story: Pickup watcher notices changed package code and restarts preserving configuration
    outcome: held
  - story: Status exposes loaded fingerprint and stale state
    outcome: held
  - story: In-flight landing defers restart and subsequently resumes safely
    outcome: held
  - story: Existing retired directories are audited and removed after landing
    outcome: unobservable
evidence:
  path: docs/attachments/long-running-reconcilers-keep-pre-change-code/drive-2.md
  visual: false
  shots: []
tests:
  - lib/reconcile/landing-cleanup.test.ts
  - lib/reconcile/resume.test.ts
  - lib/reconcile/stop.test.ts
redrive: false
caveats:
  - Story 5 is accepted by the owner as unobservable. After landing, in this order, the owner thread bootstraps the pre-change processes (terminate each exact PID, not `reconcile_stop`, then resume quietly), audits `~/dev/mmon/concept__retired` for files that exist nowhere else, and removes the directories.
  - The deferral drive used state seeded by `seed-landing.ts` (reviewer-only), because the public workflow can't hold a landing open.
  - Cost of the code check — one source hash per minute per process, a 15 s interval for the watcher's rate-limited check.
```

Evidence: [docs/attachments/long-running-reconcilers-keep-pre-change-code/drive-2.md](../attachments/long-running-reconcilers-keep-pre-change-code/drive-2.md)

Post-landing (2026-11-02, owner @thread:thr_ae8q9yrxnv): bootstrapped the five pre-change processes by exact PID (SIGTERM, then a quiet respawn with the same state): concept runs recording-replay-mistakes-skill-examples-for-tool-errors, compare-gateway-spend-with-the-ledger-after-a-week and replay-the-timed-cadence-prepare-practice-continuation, the mlegls-pi run om-memory-promotes-observer-judgments-over-the-users-own-statements, and the concept pickup watcher. All now report stale: false with their workers kept. Audited `~/dev/mmon/concept__retired` (14 directories, about 4.3 GB) against git objects. Removed 11 that held only build output (`.output`, `.astro`, `.default-theory-build`, applet runtime), worker-local `.env` files that differ from main only in ports and local URLs, local Convex dev databases, or captures already published in docs/attachments. Kept 3 at the maintainer's decision, about 290 MB: align-button-variants-with-the-action-set-ranks-drive-2 (`.wm` screenshots), align-button-variants-with-the-action-set-ranks-implement-1 (`.lavish/button-ranks` captures, 52 MB) and make-staged-decline-send-requirements-explicit-drive-4 (`.wm` login and session notes). Their tickets are done and have no attachments.
