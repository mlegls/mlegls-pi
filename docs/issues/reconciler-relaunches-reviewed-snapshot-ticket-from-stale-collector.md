---
stage: "done"
assignee: "agent:technical"
author: "session:thr_we6983izn2"
priority: 2
---
Concept's [[projects/concept/issues/restore-the-5000-card-fixture-from-a-snapshot]] was implemented, independently driven and reviewed under run `make-large-card-imports-scale-in-one-tutor-script`, owner @thread:thr_ihbpyrp6s2. Its reviewed head is `b2bc82c357a030fb87d61d319de5dba4787b8b18` (`tree/make-large-card-imports-scale-in-one-tutor-script`); the ticket already records passing cold/import and independent restore timings. The owner's log retains the implementation, drive and review handoffs (@thread:thr_gwjc333wjb, @thread:thr_bp7eh8d5px, @thread:thr_uhw67345ek).

On 2026-11-09 the same owner launched `restore-the-5000-card-fixture-from-a-snapshot-implement-22` (@thread:thr_we6983izn2) from `493b2c81957f1b071fdef6d2c1b57d712ec5319f`, the `tree/bound-card-backed-session-resource-reads` tip. That base lacks `packages/web/scripts/prepare-cached-session-deck.ts` and the retained snapshot evidence. While this worker was inspecting the existing implementation, `bb thread list --project proj_fgz6kudzrk --json` showed two more active workers for the same ticket and owner: implement-23 (@thread:thr_k7tww2jhsm) and implement-24 (@thread:thr_j3t2if7tf7). No code or long-running fixture work had begun in implement-22. Two further duplicates, implement-25 (@thread:thr_g48dfxbkyk) and implement-26 (@thread:thr_4hkqsz737y), were then launched from the same base. The tracker snapshot reports all five dispatched claims for this ticket alongside its existing collector landing.

Impact: repeated implementation launches after reviewed delivery. Implement-23 recovered the existing commits onto the newer collector at `54e6f952cfb4e384ab27f62e34c864a36f1df584` and started a real cold preparation, confirmed by its waiting handoff and running preparation at `/tmp/snapshot-implement-23-current/preparation.json` on checkout-owned port 3232. Its source key is `f1af2f9621d1a16f28dc0246ae8ea176d9bb26dd52199f6cb3bc8fe3dae91672`, with the matching shared cache lock held. The old implementation's schema and acceptance sources differ from the new collector, selecting this new key and repeating the import. The cause of the repeated launches and destination mismatch is unestablished. Related ownership/catch-up history: [[projects/mlegls-pi/issues/nested-collector-misses-landings-in-its-enclosing-collector]] and [[projects/mlegls-pi/issues/reconciler-orphans-chain-worker-spawned-before-receipt-save]].

Tried: compared the assigned base, retained implementation/drive branches, current ticket text and owner handoffs; enumerated active workers. Workaround: implement-22 and implement-25 leave their worktrees unchanged, avoid another cold import, and return the reviewed branch and observed duplicate handles to the owner for landing/recovery. Implement-23 already owns the new-key preparation; its process and lock remain untouched. No reconciler state, branch ownership or other workers were changed.

Implement-24 (@thread:thr_j3t2if7tf7) independently recovered the same six implementation/evidence commits onto its assigned base (head `69eaea778`), completed `mise run setup` for its own port 3234, and attempted the committed preparation through `mise run local:exclusive`. Functions reached readiness at 16:18:53 +08:00; preparation then failed before importing with `EEXIST` on the same `f1af2f9621d1a16f28dc0246ae8ea176d9bb26dd52199f6cb3bc8fe3dae91672.lock`. This confirms the per-key exclusion prevented another cold import. No lock or other worker's services were removed; the exclusive runner shut down this worker's backend after the refusal. Affected-test selection completed successfully with no affected test files. The current-key fixture remains implement-23's running work; implement-24 returns its recovered branch without claiming a fresh current-base count gate.

At 16:20 +08:00, implement-27 (@thread:thr_rmtd4q7gf9) observed two further same-owner launches from `493b2c819`: itself and implement-28 (@thread:thr_28akjazsdv), both active. The reviewed implementation still exists on the retained branches; implement-23's latest handoff remains `waiting` for `prepare-current-5000-card-fixture`, and the current-key lock is present. Implement-27 leaves its checkout unchanged and starts no deployment or duplicate preparation. It returns the existing implementation owner for recovery rather than copying the already-recovered commits again.

Implement-28 (@thread:thr_28akjazsdv) was also launched from `493b2c819` and recovered the existing six implementation/evidence commits at `4f6a5cf6d`. Its `mise run setup` completed in 29 seconds for its own anonymous-local port 3248. The committed preparation was attempted through `mise run local:exclusive`; functions reached readiness at 16:23:45 +08:00, then the recipe refused with `EEXIST` on the same current-key lock before any import or restore. The exclusive runner stopped its backend; `mise run local:stop` found zero checkout-owned processes. Affected-test selection passed with zero affected test files. This worker leaves implement-23's preparation and shared lock untouched and returns the recovered commits; current-key acceptance remains with that running owner. No recipe changes were needed.

Implement-29 (@thread:thr_xu7uf9buqb) and implement-2a (@thread:thr_k8i6tys4qp) were also launched from the same stale base. Implement-29 confirmed implement-23's latest explicit handoff remains `waiting` for `prepare-current-5000-card-fixture`, and the current-key lock still exists. It started no deployment, copied no commits and left its branch unchanged; recovery remains with the existing implementation/preparation owner.

Implement-2b (@thread:thr_mvfwjf3wa5), implement-2c (@thread:thr_4i3ya7gj56) and implement-2d were also launched from `493b2c819`; git lists all three worktrees. At 16:30 +08:00, implement-2c confirmed its base still lacks the snapshot recipe, implement-23's latest explicit handoff is `waiting` for `prepare-current-5000-card-fixture`, and the current-key cache lock remains present. The owning preparation receipt remains at revision `54e6f952c`, started `2026-11-09T08:15:49.971Z`, `passed: false`, with no settled verdict on owned port 3232. Implement-2b and implement-2c left their checkouts unchanged and started no services or preparation. Recovery remains with implement-23 rather than another commit copy/import.

[[projects/mlegls-pi/issues/reconciler-relaunches-fixture-implementation-while-preparation-runs]] records the same burst from implement-23's side (implement-2d through 2n, 16:31–16:49 +08) and is folded into this ticket. The efficiency audit of 2026-11-12 (@thread:thr_879y94y97m) counted 22–25 implementation launches for this one node on 11-09 08:12–08:48Z, about 2 minutes apart, costing $6–7 and killing preparations that were running.

decisions:
- 2026-11-12: a `blocked` or `waiting` report doesn't authorise a fresh implementation on the same base with unchanged prerequisites; after the same node, base and prerequisites launch twice, raise one exception instead of a third launch (maintainer, approving the audit's proposal in @thread:thr_879y94y97m).

## tasks
1. Find why the owner relaunched `implement` on `493b2c819` after the reviewed delivery and while implement-23's latest report was `waiting` (the owner's log and `lib/reconcile` scheduling).
2. Fix that path, and add the repeat guard from the decision above in [lib/reconcile/reconcile.ts](../../lib/reconcile/reconcile.ts).
3. A test in [lib/reconcile/scheduling.test.ts](../../lib/reconcile/scheduling.test.ts) replaying this sequence.

Done when: replaying the 11-09 sequence launches no second implementation while the first reports `waiting`, and a third identical launch becomes one exception.


## Verification evidence

[Offline replay packet](../../docs/attachments/reconciler-relaunches-reviewed-snapshot-ticket-from-stale-collector/index.md), including the independent drive encounter.

## Result

done — no repairs were needed. The diff fixes the 11-09 path and adds the repeat guard. I reran `bun test lib/reconcile/` (52 pass, 0 fail, about 3 minutes) and `bun run typecheck` (clean) on the final head.

I added a short review section to the driver's `index.md` and left the rest of the packet as it was.

- **Cause and fix:** the cause is in the packet and the code agrees. `catchUp` skipped locally-frontier descendants that had already landed upstream. `tick` then deleted every new chain just because its slug was in the landing ledger. Catch-up now merges the delivery, and a chain that coexists with an old landing is kept and raised once to the owner.
- **Repeat guard:** it keys on base plus prerequisites, persists before dispatch, and survives chain replacement and restart. The third identical launch raises one exception.
- **Linked tracker issues:** `reconciler-relaunches-fixture-implementation-while-preparation-runs` and `notice-replay-setup-does-not-expose-recorded-followup-state` are already `done`. Nothing was left to settle or file.

```yaml
commit: 9f8bedf9
stories:
  - story: Reviewed delivery catches up the stale collector without reimplementation
    outcome: held
  - story: A waiting implementation retains ownership without a second launch
    outcome: held
  - story: A third identical launch produces one stable exception
    outcome: held
evidence:
  path: docs/attachments/reconciler-relaunches-reviewed-snapshot-ticket-from-stale-collector/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/scheduling.test.ts
filed: []
caveats:
  - "Outcomes come from the offline fake-bb replay, not a live Concept deployment."
  - "Cost of the guard: an implementer that dies twice without committing (same base) now escalates to the owner instead of getting a third automatic relaunch. A predecessor's commits change the base and reset the count."
```

Evidence: [docs/attachments/reconciler-relaunches-reviewed-snapshot-ticket-from-stale-collector/index.md](../attachments/reconciler-relaunches-reviewed-snapshot-ticket-from-stale-collector/index.md)
