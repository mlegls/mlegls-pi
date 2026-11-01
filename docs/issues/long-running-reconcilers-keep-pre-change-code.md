---
stage: "idea"
assignee: "agent"
author: "session:thr_wqjd4uttrr"
---
Observed 2026-10-30 by the adversarial review (@thread:thr_wqjd4uttrr). 62236427 (2026-10-29 23:16) made retirement discard a worker's ignored state, with no `__retired` directory, `RETIRED.md` or `wm.disposable` (maintainer, @thread:thr_2t36fi5c4u#msg=653). After it landed, `~/dev/mmon/concept__retired` still gained twelve directories with `RETIRED.md` and `retirement.json`. The latest is `verify-default-runtime-tutor-startup-and-writer-recovery-implement-o` at 10-30 03:20, holding `.wm/capture-production-startup.ts`. The directory holds 4.0 G.

Cause (from `ps`): reconcilers started before the commit keep running the code they loaded. These are `lib/reconcile/main.ts run` for move-the-scheduled-tutor-writer-to-the-default-runtime (10-29 21:06), read-first-map-time-from-production-timings, author-and-publish-the-language-learning-template and compare-gateway-spend-with-the-ledger-after-a-week (10-29 21:39), align-button-variants-with-the-action-set-ranks (10-28) and replay-the-timed-cadence-prepare-practice-continuation (10-26). The pickup watcher has run since 10-26 07:08. A change to retirement, landing or scheduling code doesn't reach a run until someone restarts it, and nothing says when that's needed.

Expected: a running reconciler or watcher notices that the package code it loaded has changed on main. It then either restarts itself at a safe point between ticks or reports that it's stale through `reconcile_status` and `pickup_status`. The existing `concept__retired` directories are then removed once each is checked for files that exist nowhere else.

Efficiency audit 2026-11-02 (@thread:thr_ae8q9yrxnv; auditor @thread:thr_jzyk5zr226): the retirement-notice fix ([[projects/mlegls-pi/issues/retirement-notices-and-retired-checkouts-pile-up]]) landed 10-26, yet the concept supervisor still answered about 86 old-style "retired … kept" notices until 10-29 15:16Z, because reconcilers started before it kept the old code: about three days and roughly $15 of supervisor turns. Five "integration failed 3 times (ff-only)" exceptions on 10-28 and 10-29 likewise stopped only once runs picked up 9f27fe3e.
