---
stage: done
assignee: agent:fill
author: session:01a12f88-e529-7473-951d-ed4cb0f4a7c5
part-of: "[[projects/mlegls-pi/issues/reconcile-with-global-tracker-and-landing-ledger]]"
blocked-by: ["[[projects/mlegls-pi/issues/activate-global-reconcile-runtime]]"]
priority: 2
---

Commit the actual-run collector scheduling, restart and linked-owner first-use modes in `docs/attachments/reconcile-with-global-tracker-and-landing-ledger/ledger.ts` and `ledger.md`. This is drive machinery, not another production implementation or retained test suite.

## Context and ownership

Read the enclosing ticket's first-use/story contract and fixed `GlobalRunState`/landing types. Precedents: `docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts` seeds a registered saved review chain and lets actual run/integrate consume it; `docs/attachments/worker-setup-failure-after-admission-escapes-launch-retry/fixture.ts` supplies deterministic shell workers through real start/stop/board paths. Use real `run`/`start`, `saveState`/`load`, Tracker, scheduler and integration APIs. Do not manually compute frontier or invoke completion helpers in place of the run. Own only ledger.ts and ledger.md; the sibling refinement rehearsal is independently disposable and touches different files. A located runtime defect may be repaired/re-driven while context is warm, without weakening acceptance.

## Runnable modes

`bun <checkout>/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/ledger.ts collector|restart|close-replay|linked-owner` works from any cwd; the default runs all four, sequentially, in separate fixture repositories.

- **collector:** seed a spec root with executable tickets a and b; b blocked by a; outside executable issue also blocked by a. Stance roster is one shell stance for each used role, with deterministic reports/code commits, no decide/model calls. Let actual scheduling launch a, run its code through the existing phases/gates and land into root collector. Hold the root's final report/integration with a fixture-owned sentinel. At that pause read the canonical CLI snapshot with inflight, the persisted state ledger and b's actual thread/branch initial base plus a's code file. Observe a/b globally open, a pending in flight, b launched exactly once from collector code containing a, outside not frontier. Release root, then read code in owner, per-node global result evidence, final ledger/status/frontier. a/b/root globally done; outside frontier. Root result uses join packet, not either leaf's packet.
- **restart:** restore a state saved after a collector landing and retirement, with its actual code/ledger/result present and before root delivery. Restart the run; observe no second a worker/integration, b dependency selection still uses collector code, and the same saved leaf result reaches global close. Compare code ancestry/worker identities or counted gate/integration receipts, not HEAD alone (global tracker persistence may also add commits).
- **close-replay:** seed a valid saved run whose code has already reached owner and ledger/results/landingOps reflect that, but whose child-first close sequence is incomplete. Leave one leaf closed and remaining results pending. Start actual run from this deterministic persisted cut point; observe no worker launch/code reintegration, replayed own results/close ordering and finished done only after every pending close. Also exercise a saved prepared operation with code already merged and no ledger transition, letting actual run recover it by code ancestry. Never arrange the crash by a sleep/timing guess.
- **linked-owner:** repeat target-reaching scheduling/closure with State.cwd an absolute linked worktree, not the git common directory's main checkout. Invoke restart from main once to prove persisted target wins. Canonical tracker writes still occur in main, but delivered code lands in the linked owner, collector ab-parent identifies that owner branch, the ledger into equals its absolute path, and canonical main lacks delivered code. Evidence locators remain each node's code artifacts; do not require the backend to copy attachments into main.

## Setup and evidence

Each mode creates a private mkdtemp repo and restores process.env on exit. Set isolated XDG_STATE_HOME, PI_BOARD_DIR, PI_CODING_AGENT_DIR, ZMX_DIR, MISE_TRUSTED_CONFIG_PATHS and any host-slot/pressure selectors used by the shell precedent. Explicit PI_THREAD_RUNTIME=zmx; checkout-local TRACKER_CLI and PI_AGENTS_DIR/role paths derived from import.meta.dir, configured before importing modules that cache them. Clear inherited PI session/worker/board selectors, BB identity/runtime ancestry and tmux/zmx identities. Explicit fixture authors avoid dependence on a live session's provenance. Fake pi is a shell command, never a real model client. Observe readiness before sending reports: fixture setup/registration/launch receipts, not just PID existence. Each fixture owns and cleans only its started PIDs, registered workers and worktrees; cleanup also covers failure paths, no kill-by-pattern.

Record commands, prepared target/readiness, transient pause data (canonical stages/frontier/claims, ledger into/head, b launch/base/code), restart cut points and final results in ledger.md per docs/verification-evidence.md. Make these named modes fail nonzero on a story mismatch, not merely print success counts. Do not retain raw intermediate logs. No new retained tests are approved. The enclosing ticket joins this with sparse/refinement modes under one index/entry point; it owns the combined run and any final seams.

## Verification evidence

[Encounter and evidence](../attachments/rehearse-collector-ledger-and-owner-restart/index.md).
