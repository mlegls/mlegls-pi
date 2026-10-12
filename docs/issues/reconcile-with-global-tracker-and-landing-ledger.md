---
stage: ticket
assignee: agent:technical
author: session:01a12f5a-57a3-74f5-be56-010e18f3b368
part-of: "[[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]]"
blocked-by: ["[[projects/mlegls-pi/issues/global-vault-tracker-backend]]"]
priority: 2
---

Replace per-branch tracker observation with the parent's global `Tracker`, landing ledger and provisional-refinement ownership. Preserve the existing worker phase chain, budgets, evidence gates and exception routing.

## Context and ownership

Read the parent's decisions and committed `lib/tracker.ts` / `lib/reconcile/tracker-state.ts` contracts, then:
- `lib/reconcile/reconcile.ts`: `State`, `snapshot`, `ticketText`/`driveNone`, `startPhase`, `applyResolution`/`handleExceptions`, `land`, `onReport`, `visit` and `tick`.
- `lib/reconcile/main.ts`: first-start state, restart/stop and status. The target is persisted `State.cwd`, not necessarily the main worktree.
- `skills/enabled/all/mlegls/conventions/tracker/scripts/inflight.ts`: existing run/dispatch/branch claims; delete the branch-diff scan for branch-local `stage: done` and replace it with ledger claims.
- `lib/reconcile/refresh.ts` still carries collector *code* into phase successors; global tracker rulings no longer require that merge to transport the contract.
- `lib/reconcile/refresh.test.ts`, the other existing reconciler tests and their imported fixtures. `docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts` is the offline saved-review-chain + real integrate precedent. `docs/attachments/worker-setup-failure-after-admission-escapes-launch-retry/fixture.ts` is the shell-worker retry precedent.

Own these runtime/state/projection files and affected fixtures. Child 1 has already filled the backend and sparse/refusal helper; child 3 owns instructions, not runtime. The only seam child 3 needs is the provisional claim token supplied in the prompt, `reconcile:<root>/<refine-handle>`, and the global write verbs already fixed by the parent.

## Edit contract

1. Obtain one `getTracker(cwd, {inflight: false})` for the run. Replace branch/path snapshot calls and HEAD caches with its current global snapshot; `Tracker.text(slug)` supplies contracts, `fields(slug).drive === "none"` supplies drive suppression. No runtime code opens `Issue.file` or uses a branch's issue blob as a fallback, including successor-conflict and handler prompts. Keep fail-closed snapshot diagnostics and automatic retry after the tracker is repaired.
2. Add required `State.landed: LandingLedger`, initialize it for every new state and every fixture, preserve it across restart/stop and expose it in status. Do not silently treat a pre-ledger run as having an empty ledger or reconstruct one from branch issue files: identify the manual rebuild required by the parent's cutover decision.
3. A successful collector integration records `landed[slug] = {into: c.into, head: destination code HEAD, at: ISO timestamp}` before retiring/deleting its chain or collector. It does not close the global issue. The record survives restart and prevents re-launch/re-integration. A collector's own landing carries its pending descendant records to the next destination (update their `into` and containing code `head`); do not leave entries pointing at a deleted collector.
4. Only a successful code landing in the absolute owner's checkout may call `Tracker.close`, child-first for the node and pending descendants actually carried by that landing. Keep each leaf's reviewed summary/evidence in persisted state when its chain is removed so its eventual result is not replaced by the root's packet. The root's own result follows its join evidence. Store the target-reaching ledger transition before closing, and replay incomplete closes on restart before declaring finished; already landed code is not integrated twice if a tracker write/persistence or retirement fails. Never mark done during prepare or before an unsuccessful gate/merge. Keep the ledger as the run's audit/idempotence record.
5. Derive the scheduling view from the global lifecycle rows plus this run's landing context. Within a collector, count a node as satisfied when globally done/archived or ledger-landed into that exact collector; apply that to children and blockers before readiness/frontier, parking and join selection. Do not merely flip `frontier` or discard a blocker's string: recompute remaining subtree readiness/eligibility/claims/selectors from `ownStage`, `partOf`, `blockedBy`, guards and the locally satisfied set, mirroring the existing tracker lifecycle model. Raw guards and foreign stored claims still block; this run's attempt and accepted-child reservation claims reserve work from outsiders but don't block its own scheduling. A landing in a different collector does not satisfy an outside sibling. When all children are collector-landed, start the existing @self chain from that collector while canonical stages remain open. Human/deferred/move-out behavior survives.
6. Delete `catchUp`, `trackerParses` and branch-writing `close` from checks. `setAsideIdeas` detaches accidental idea descendants through `Tracker.update` (fields and body), keeping the filed-under link and owner notice in global state; no git commit in a collector. Handlers record decisions/move-outs through the global tracker; integrate only their allowed code-evidence/docs artifacts if any, not tracker records. Keep their scope restriction and escalation behavior. The backend already validates writes; the landing refusal from child 1 still guards code branches.
7. Before launching each refine attempt, persist its original subtree identities and the parent fields needed to restore valid residual stage if it fails. Supply the exact attempt claim token in its prompt; child creation writes that claim atomically with `part-of`. Observe and persist newly created owned descendants while the refiner is running, but never schedule them before decomposition succeeds and its committed stubs land. The claim token plus saved baseline—not mere parenthood—is deletion authority.
8. On failed, dead, abandoned or replaced refinement, stop the old writer before cleanup. Remove only its still-provisional new children through the tracker, in graph-safe order; restore the parent stage when deleting the last child would make its omitted stage invalid. A same-work continuation/checkpoint or explicitly adopting retry may retain the children, recording adoption into the successor attempt before releasing the old ownership. An unadopted replacement leaves none of the failed attempt's children in the tracker. On successful promotion/decomposition, refresh the issue from the tracker, validate the reported children, land any stubs into the collector, then convert their attempt claims to `reconcile:<root>` and record acceptance. Keep that reservation until target close; clear it on move-out so human work isn't stranded behind the departed run. Keep pre-existing children, unrelated friction, and children no longer owned by the attempt. Cleanup/claim transitions must be restart-safe, including a create that happened just before a crash and before the next observation.
9. Extend `inflight.ts`'s structural run reader with the ledger. An unfinished run reserves its root even between chains. Its open ledger nodes show derived `landed in <collector> (awaiting target)` claims even after their chain and worktree were retired; missing process still says stalled. Existing dispatch and issue-named branch claims remain. Remove the `git show <branch>:docs/issues/...` closure heuristic. Finished runs/now-global-done nodes do not emit pending-landing claims.

The scheduling overlay is private to the run. Canonical CLI snapshots never claim collector-landed children are done and never release outside blockers from a ledger. Keep globals independent of the owner checkout's branch.

## First use

Commit a runnable scratch rehearsal and index under `docs/attachments/reconcile-with-global-tracker-and-landing-ledger/` that the parent and driver can run from any checkout. Follow the existing saved-chain/shell-worker fixtures; set isolated `XDG_STATE_HOME`, `PI_BOARD_DIR`, `PI_CODING_AGENT_DIR`, `ZMX_DIR`, `MISE_TRUSTED_CONFIG_PATHS`, explicit zmx shell runtime, checkout-local tracker CLI and agent prompt paths. Clear inherited session/BB/runtime identities. Use no model decisions or paid workers: seed deterministic phase reports/registered shell workers as the precedents do, and let the actual `run`, scheduler, landing and tracker APIs perform the transitions.

Modes must cover:
- A spec root with tickets a and b, b blocked by a, and an outside issue blocked by a. Pause before root integration to read canonical snapshot + persisted ledger + actual b launch/base; then release the root and read final state/frontier.
- Failed refinement after tracker-created claimed children, including an attempt stopped/replaced; observe removal and no dependent dispatch from the failed decomposition. Exercise an explicitly adopted continuation separately.
- Restart after a collector landing, and replay after a target-reaching ledger write but before all closes complete. Use saved states/deterministic interruption, not a timing guess.
- The same target-reaching story with the owner in a linked worktree, proving code/closure target is that checkout rather than canonical main.
- Sparse worker CLI read, reusing child 1's fixture where useful.

Each mode owns and cleans only its fixture's processes, workers and worktrees. Record transient states and commands in the evidence index, not just a final success count. The parent owns the combined cross-child drive; this ticket makes it reproducible.

## Stories and acceptance

- b starts once a's code lands in their collector, but canonical a/b stay open, a is in flight, and the outside issue stays blocked. After the root lands in the owner's checkout, a/b/root are globally done with their own results, and the outside issue is frontier.
- A failed/unadopted replaced refiner leaves none of its newly created children; an adopted continuation keeps only its owned children, with no duplicate dispatch.
- Restart consumes the ledger without repeating code integration or losing pending completion/evidence, including when the owner is not main.
- Worker/handler successor prompts and `drive: none` observe the current global contract, despite no local tracker files; collector code refresh still preserves predecessor work and runs before setup.
- Existing `bun test lib/reconcile` and `bun test skills/enabled/all/mlegls/conventions/tracker/scripts` pass, plus `bunx tsc --noEmit`. Rewrite per-branch tracker fixtures while retaining their conflict, gate ordering, retry budgets, stop cleanup and fresh-before-setup properties. Child 1 owns physical sparse/landing-refusal assertions; this child owns the global ruling rewrite in `refresh.test.ts`. Update fixture state builders everywhere touched by the required ledger field.

No new retained tests are approved; first-use modes are drive machinery. State migration, GitHub implementation and PR landings are outside this ticket. Name deliberately changed per-branch assertions in the result.
