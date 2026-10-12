---
stage: ticket
assignee: agent:technical
author: session:01a12f88-e529-7473-951d-ed4cb0f4a7c5
part-of: "[[projects/mlegls-pi/issues/reconcile-with-global-tracker-and-landing-ledger]]"
priority: 2
drive: none
---

Fill the durable code-landing/completion protocol in `lib/reconcile/completion.ts`, without wiring it into the live reconciler. It must persist the collector ledger before retirement, and close only results that reach the absolute owner target.

## Context and ownership

Read the enclosing ticket, `lib/tracker.ts`, the fixed types in `lib/reconcile/tracker-state.ts` and the stub `completion.ts`. Existing mechanics to move, not redesign: `lib/reconcile/reconcile.ts:land`, `lib/reconcile/checks.ts:declaredGates/testCommands/testRun/evidencePacket`, `lib/reconcile/landing.ts`, `lib/dispatch.ts:integrate`, `lib/thread/lifecycle.ts:integrateThread`, `lib/thread/tracker-worktree.ts`.

Own `lib/reconcile/completion.ts`, and `docs/attachments/reconcile-with-global-tracker-and-landing-ledger/landing-probe.ts` / `landing-protocol.md`. Existing production call sites and test fixtures stay unchanged until [[projects/mlegls-pi/issues/activate-global-reconcile-runtime]]. The callback context supplies the run's state, its one Tracker, save, destination resolver and integration lock.

## Literal implementation contract

1. `reviewedResult` stores this node's parent and full accepted handoff. Summary is its nonempty string `handoff.summary` when present, otherwise the reviewed report itself. Preserve its own evidence locator, including root join evidence when present; never substitute an ancestor's packet. Validate packet artifacts on the final prepared worker head with the existing `evidencePacket` gate (a self chain may omit evidence, as today).
2. `landReviewed` uses actual `integrate(..., keep:true)`, with the current dependency-prep → declared gates → retained tests → packet-validation ordering. Call `assertNoTrackerChanges` before the conflict probe; ordinary code-conflict diagnostics keep target subjects/files and leave both checkouts unchanged. Refusal is not an append union. Green-owner waiting remains in the runtime wrapper.
3. Before integration, save `landingOps[slug]`: exact into, destination, destination before-head, worker, carried ledger identities, result and cleanup receipts. Carried identities are precisely the pending entries into the collector being carried by this node; do not gather every graph descendant irrespective of its landing destination. In integrate's preparation callback, save the rebased/prepared `preparedHead` only after gates and evidence validation succeed and before the destination merge. A save failure there aborts the landing.
4. On success, persist `landed[slug]`, `results[slug]` and the operation's landed head/time. Move every carried pending entry to the new into and containing destination code head in that same state save. No Tracker.close or retirement in this method. Return `{ok:true,head,replayed}`; failures before a proven landing return `{ok:false,failure}` with existing useful conflict/gate diagnostics. A post-merge persistence failure must remain replayable, not be mistaken for code that needs another integration.
5. `recoverLandings` checks the saved prepared code head's ancestry in the recorded destination under the integration lock's serialization boundary supplied by the caller. If the merge reached it before ledger persistence, perform the same ledger transfer and save; if not, leave the operation pending for the existing chain to retry. No git issue blobs, stage inference or automatic pre-ledger migration. `landReviewed` on an already-ledger-landed operation does not call integrate again or replace its reviewed result.
6. `closeAtTarget` considers only ledger entries whose into exactly equals absolute `state.cwd` and which have a persisted reviewed result. Persist target transition first, then call Tracker.close child-first using saved parent identities and the carried landing set. Save `closedAt` only after each close returns. Replay exact pending closes even when a previous call published stage done but persistence threw; do not skip that persistence retry on a visible done stage. Archived results require no reopening/close. On a tracker/save error, leave pending work and throw so the runtime retries before finishing. Collector landings never close.
7. Keep ledger/results/operations as audit after success. `finishLandingCleanup` marks cleanup complete only after the runtime confirms every recorded worker/collector was retired. The receipts survive chain removal and failed retirement, so restart can retry cleanup without re-merging code.

Keep the types in the committed seam; protocol-specific private functions may be added inside this module. Do not activate State fields or modify Tracker/CLI writes.

## First use and acceptance

Commit `landing-probe.ts`, a disposable Bun rehearsal using isolated git repository, actual registered worker threads + integrate and a real global Tracker, mirroring `docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts`. Exercise a collector landing (still-open global stage), carried descendant transfer to owner, distinct saved leaf/root results, and a target-reaching close interrupted by a deterministic Tracker wrapper that throws once after delegating the real write. Restore the saved state and replay pending closes. Also save a prepared operation whose code is already merged but ledger isn't saved; recovery must record it without another destination integration. Include a failed declared gate and code conflict: destination/ledger/close stay unchanged; conflict report remains useful. Retain the gate order evidence.

Use checkout-local tracker paths, isolated state/board/agent/zmx selectors, no model calls, and only fixture-owned process/worktree cleanup. Record code heads, ledger entries and result locators in `landing-protocol.md`; do not claim actual scheduling from this helper probe. Run `bunx tsc --noEmit`.

This is `drive: none` while the module is dormant. The enclosing join's actual-run restart/linked-owner modes are the post-landing gate. No new retained tests are approved.