---
stage: "done"
assignee: "agent:technical"
author: "session:01a1cccf-a7df-701e-87e3-244f9e676da7"
priority: 2
---
Refining `verify-full-5000-card-profile-opening` (concept repository) under the mlegls-pi reconciler started at `68c8b1c46` although the issue's implementation handoff names the retained fixture, reader repairs and rendered packet from the preceding attempt. Those changes exist only on branch `verify-full-5000-card-profile-opening-implement-k`: `0b03ae74c`, `c5df6d4f8`, `e6e8151fb`, `bb4183c85`, and evidence commit `1a5bca821`. `git branch --all --contains bb4183c85` lists only that branch; the collector and refinement base omit all five commits. The linked opening packet and the preparer's `--profile-opening` mode are consequently unavailable in this checkout.

Observed in @thread:thr_u9tmjs4vhq. `git log 68c8b1c46..verify-full-5000-card-profile-opening-implement-k` locates the five commits. Reading the prior branch's attachment with `git show` recovered the timing evidence for refinement. The retained head is a direct descendant of `68c8b1c46`, so the authorized workaround is for the first repair worker to fast-forward its own implementation branch with `git merge --ff-only 1a5bca821`; all five prerequisite commits then travel with that repair through normal child integration. The enclosing contract and [[projects/concept/issues/shorten-compact-profile-document-reading]] record this instruction (@thread:thr_tk3964w2wu). No collector was changed by the handler; adoption and subsequent measurement remain with the repair worker.

Owner: mlegls-pi's reconciler partial-implementation/refinement handoff. This records the missing-base observation; whether partial implementations should be adopted before refinement or explicitly carried as a pending input remains to be resolved there.


Moved from the concept tracker on 2026-11-12 (triage @thread:thr_fwa3eezsuz). The concept supervisor's workaround: the handler told the repair child to `git merge --ff-only` the retained head in its own implementation checkout.

The next refinement, shorten-compact-profile-document-reading-refine-o (@thread:thr_rwxifxuxyn), again started at 68c8b1c46 after the failed implementer retained product repair 38063ce72 and evidence 590bb7087 on shorten-compact-profile-document-reading-implement-m. Reading the linked compact-reader.md failed with ENOENT until adopting that branch. git log on the retained implementation branch found the evidence head; git merge --ff-only 590bb7087 in the refinement checkout restored the fixture, repair and packet. The refinement carries that head through its ordinary integration handoff; the collector was unchanged.

The startup continuation refinement `shorten-fresh-practice-and-session-reading-startup-refine-2` (@thread:thr_ds87s3sttk) recurred on 2026-11-16 at `f042591bf`: both linked `drive-startup.md` and `ordinary-session-startup.json` were absent, and the server sources omitted the compact/browser/ordinary-credential repairs. The global ticket names retained branch `shorten-fresh-practice-and-session-reading-startup-implement-1`, whose evidence head is `e7d54e22e` (product `51aa914f7`, capture helper `173300f02`). `git worktree list` showed that implementation checkout already retired. Reading an archive of the retained head under `/tmp` recovered the sources and evidence for refinement without changing the collector. The new child [[projects/concept/issues/shorten-retained-compact-selection-capture-work]] owns adoption of `e7d54e22e` into its implementation branch before continuing, carrying it through normal child integration; the parent records the same prerequisite.



Recurred three times between 2026-11-16 and 2026-11-19 as concept supervisor exceptions (@thread:thr_ihbpyrp6s2#msg=35277, #msg=36209, #msg=38871): the 5,000-card startup worker launched without 42 retained commits in a collector and a browser startup repair on an older branch, and workers on strand tagging and card-to-Problem storage launched without a prerequisite already on main. The 2026-11-19 efficiency audit (@thread:thr_ivvhpy2bsb) proposes: before spawning a phase, require `git merge-base --is-ancestor` against the proposed base for each landed prerequisite and explicitly adopted checkpoint; advance from the recorded source ref, and hand a merge conflict to the owner once. This body was emptied by `8ac9dcf6` ([[tracker-update-can-wipe-an-issue-body]]) and restored from `647161aa`.

## tasks

Before spawning a phase, the reconciler requires `git merge-base --is-ancestor` against the proposed base for each landed prerequisite and each explicitly adopted checkpoint (a retained partial implementation the handoff names). When one is missing, it advances the base from the recorded source ref itself; a merge conflict goes to the owner once.

1. What a launch requires, from machine-readable sources only:
   - landed prerequisites: the node's `blocked-by` issue links as the run has seen them. Closing a blocker removes the edge from its dependents (the strand-tags dependent lost its `let-patches-add-members-to-base-tags` edge that way before its implementer launched), so the run records each node's links when the walk first sees them and keeps them after the edge goes. Each resolves to its landing in any run's ledger (`landed[slug]` in `<git-common-dir>/reconcile/*.json`, this run's included): `head` is the commit, the `into` checkout's current HEAD the source ref. A prerequisite with no ledger entry isn't checked.
   - adopted checkpoints: commits the node's superseded attempt declared in its handoff's `commit` key, sourced from that attempt's kept branch (this covers respec → refine, which today drops them without even the `keptWork` note); a commit an owner's or handler's `reconcile_resolve` names for adoption; a stopped run's `resume` record, which is already the base. An issue body naming a retained branch in prose is not a source: the handlers who wrote those workarounds would name the commit in their resolution instead.
2. Check in `startPhase` and the fresh-chain start in [reconcile.ts](../../lib/reconcile/reconcile.ts) with `isAncestor` ([checks.ts](../../lib/reconcile/checks.ts)), before dispatch. Advance by merging each missing requirement's source ref without a worktree (`git merge-tree --write-tree`, then `commit-tree`), so a conflict is known before any worker exists. The worker's `refreshWorker` merge of its destination stays as it is.
3. A conflicting advance raises one owner exception naming the requirement, base, source ref and conflicting files, and holds the chain. The same (base, requirement) isn't raised again; the owner's resolution (a merged revision to adopt, or an answer to launch without it) releases it.
4. Done when replays against concept's history, read-only, give these outcomes (@thread:thr_6get5yjqhu established them with `git merge-tree`):
   - launch on a base containing the requirement, no exception: strand tags (`9b20c1938` → main `2108745e1`, containing prerequisite `8bfc65b8b`; a fast-forward) and the startup refinement's missing checkpoint (`f042591bf` → `e7d54e22e`; clean).
   - one owner exception, no launch: the 5,000-card startup (`87bb5753b` → collector `0afc596da`, before adopting `5b3c50dcf`; four conflicts, which the original worker resolved by hand in `3ede6f0a7`) and card-to-Problem storage (`022f159e4` → `00dca0acb`, containing `76d691f98`; four conflicts, including the Problem union).
   Card-to-Problem's prerequisite, [[projects/concept/issues/generate-and-grade-problems-by-program]], was named only in [[projects/concept/issues/store-a-card-as-a-problem]]'s prose; its replay pins the `blocked-by` edge it would now need.

decisions:
- 2026-11-19: the reconciler checks and advances the base itself, with conflicts to the owner once (maintainer, efficiency audit @thread:thr_ivvhpy2bsb).

## Result

done — All four historical replays held. Both conflicts stopped dispatch and raised one owner exception. I fixed a resolution path that could apply an answer to the wrong chain, and verified that a misdirected answer leaves the launch held. All 20 affected tests passed.

```yaml
commit: f50869b1
stories:
  - {story: "Strand tags launches with the landed prerequisite after edge removal", outcome: held}
  - {story: "Startup refinement launches with the retained checkpoint", outcome: held}
  - {story: "5,000-card startup holds on conflict and launches after adoption of the merged revision", outcome: held}
  - {story: "Card-to-Problem holds on conflict and launches after the owner waives the prerequisite", outcome: held}
evidence:
  path: docs/attachments/reconciler-refinement-base-omits-retained-partial-implementation/index.md
  visual: false
  shots: []
fixed:
  - "20beca54: Bind a launch-conflict resolution to the held node."
  - "f50869b1: Show spawned worker titles in the replay, distinguishing the superseded implementer from its refiner."
tests:
  - lib/reconcile/launch-recovery.test.ts
  - lib/reconcile/landing.test.ts
  - lib/reconcile/resume.test.ts
  - lib/reconcile/stop.test.ts
  - lib/reconcile/retry.test.ts
  - lib/reconcile/exceptions.test.ts
  - lib/reconcile/refinement.test.ts
filed: []
caveats:
  - "Cross-run prerequisite lookup scans the ledgers on phase launch when a node has recorded blockers. One lookup across Concept’s 371 ledger files took 45 ms."
```

Evidence: [docs/attachments/reconciler-refinement-base-omits-retained-partial-implementation/index.md](../attachments/reconciler-refinement-base-omits-retained-partial-implementation/index.md)
