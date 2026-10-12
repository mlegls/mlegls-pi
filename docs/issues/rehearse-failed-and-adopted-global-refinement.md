---
stage: done
assignee: agent:fill
author: session:01a12f88-e529-7473-951d-ed4cb0f4a7c5
part-of: "[[projects/mlegls-pi/issues/reconcile-with-global-tracker-and-landing-ledger]]"
blocked-by: ["[[projects/mlegls-pi/issues/activate-global-reconcile-runtime]]"]
priority: 2
---

Commit actual-run failed/replaced/adopted provisional-refinement modes in `docs/attachments/reconcile-with-global-tracker-and-landing-ledger/refinement.ts` and `refinement.md`. This ticket owns executable first-use machinery, not production protocol implementation or retained tests.

## Context and ownership

Read the enclosing first-use/story contract, `lib/reconcile/refinement.ts`, `tracker-state.ts` and activated `run`/`start`/resolution/stop entry points. Shell-worker precedent is `docs/attachments/worker-setup-failure-after-admission-escapes-launch-retry/fixture.ts`; saved registered report-chain precedent is `docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts`. Use the actual scheduler and Tracker APIs, not calls to the ownership helper in place of production execution. Own only refinement.ts and refinement.md. The parallel ledger rehearsal uses independently disposable fixtures, no shared file ownership. Repair a located in-scope production defect if needed, then re-drive it; do not soften acceptance.

## Runnable modes

`bun <checkout>/docs/attachments/reconcile-with-global-tracker-and-landing-ledger/refinement.ts failed|replaced|adopted|accept-replay` works from any cwd; default runs them sequentially in independent fixture repos. Give each used role exactly one deterministic shell stance so no model selection/API occurs.

- **failed:** seed a spec with a globally done baseline child (so actual run can launch the parent refiner), unrelated friction outside its tree and an outside dependency. Let actual run launch refine; read its prompt's exact claim token, then have the shell/fixture writer create new claimed children x and y through Tracker.create with part-of in the same write; y is blocked by x. Observe saved ownership and no child implement dispatch while refine is still writing. Send a failed terminal report; let run stop its writer and clean only the still-owned new children. Preserve baseline child, unrelated friction, and a new child whose claim was deliberately changed away from this attempt. Show parent residual stage remains valid when removing its last provisional child would otherwise leave omitted stage. Dependents from failed decomposition never launch.
- **replaced:** steer a live provisional attempt through actual resolution `{action:"retry"}` without adoption; include a child created just before a deterministic saved-state crash cut point but absent from the last saved owned list. Restore/start that state. Observe old exact writer stopped before deletion, crash-adjacent child discovered by token+baseline, no leftovers from unadopted replacement and a new attempt token/baseline. Exercise explicit stop while provisional children exist and verify cleanup still protects unowned/baseline work. No pattern-killing or pretending a dead process is the owned writer.
- **adopted:** keep the same work through a checkpoint continuation or explicit owner `{action:"retry",adopt:true}` while children still exist. Save/read the successor adoption relation before old ownership release; observe claims transfer to its exact token and no dependent dispatch during transfer. The successor reports the same child identities (no duplicate create), commits a code-only stub and reports done. Only after stub landing do stable `reconcile:<root>` claims appear and each accepted child launches once from that stub's code. Closed/removed attempts cannot resurrect their children.
- **accept-replay:** seed registered shell refiner/state at the committed protocol's accepting cut point, with the stub merge already in collector but acceptance/claim conversion only partly persisted and the board report cursor already consumed. Restart actual run; observe pending acceptance replay, remaining stable claims converted, no second stub merge and no duplicate child dispatch. Also restore a partial adoption/cleanup cut point to show exact ownership survives a claim/remove that published immediately before the crash. Cut points are explicit saved state + code heads, not races against timers.

## Setup and evidence

Mirror the enclosing first-use isolation: private mkdtemp repo; isolated XDG_STATE_HOME/PI_BOARD_DIR/PI_CODING_AGENT_DIR/ZMX_DIR/MISE_TRUSTED_CONFIG_PATHS; explicit PI_THREAD_RUNTIME=zmx; checkout-local tracker CLI and shell agent/role paths established before cached-module imports; clear inherited session/BB/runtime/worker/tmux selectors. Fixture seed writes supply author provenance. Fake pi/saved reports replace inference only; actual run, launch/stop, global tracker, scheduler and integrate still perform transitions. Wait for setup/thread readiness before reports. Track and clean only fixture-owned PIDs/registered threads/worktrees on success and failure.

Record commands, setup/readiness, original baseline, attempt/successor tokens, before/after child lists, stub ancestry and actual child launch receipts in refinement.md per docs/verification-evidence.md. Each named mode fails nonzero on a mismatch. These are drive scripts, not imported retained tests; no new retained tests are approved. The enclosing ticket owns the combined index/entry and final cross-mode drive.

## Verification evidence

[Encounter and evidence](../attachments/rehearse-failed-and-adopted-global-refinement/index.md).
