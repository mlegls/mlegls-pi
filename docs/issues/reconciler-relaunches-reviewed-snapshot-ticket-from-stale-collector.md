---
stage: "idea"
assignee: "agent:technical"
author: "session:thr_we6983izn2"
priority: 2
---
Concept's [[projects/concept/issues/restore-the-5000-card-fixture-from-a-snapshot]] was implemented, independently driven and reviewed under run `make-large-card-imports-scale-in-one-tutor-script`, owner @thread:thr_ihbpyrp6s2. Its reviewed head is `b2bc82c357a030fb87d61d319de5dba4787b8b18` (`tree/make-large-card-imports-scale-in-one-tutor-script`); the ticket already records passing cold/import and independent restore timings. The owner's log retains the implementation, drive and review handoffs (@thread:thr_gwjc333wjb, @thread:thr_bp7eh8d5px, @thread:thr_uhw67345ek).

On 2026-11-09 the same owner launched `restore-the-5000-card-fixture-from-a-snapshot-implement-22` (@thread:thr_we6983izn2) from `493b2c81957f1b071fdef6d2c1b57d712ec5319f`, the `tree/bound-card-backed-session-resource-reads` tip. That base lacks `packages/web/scripts/prepare-cached-session-deck.ts` and the retained snapshot evidence. While this worker was inspecting the existing implementation, `bb thread list --project proj_fgz6kudzrk --json` showed two more active workers for the same ticket and owner: implement-23 (@thread:thr_k7tww2jhsm) and implement-24 (@thread:thr_j3t2if7tf7). No code or long-running fixture work had begun in implement-22.

Impact: repeated implementation launches after reviewed delivery, with a 71-minute cold fixture rebuild at stake. The old implementation's schema and acceptance sources differ from the new collector, so blindly repeating its command selects a new cache key and repeats the import. The cause of the repeated launches and the destination mismatch is unestablished. Related ownership/catch-up history: [[projects/mlegls-pi/issues/nested-collector-misses-landings-in-its-enclosing-collector]] and [[projects/mlegls-pi/issues/reconciler-orphans-chain-worker-spawned-before-receipt-save]].

Tried: compared the assigned base, retained implementation/drive branches, current ticket text and owner handoffs; enumerated active workers. Workaround: leave the worktree unchanged, avoid a duplicate cold import, and return the reviewed branch and observed duplicate handles to the owner for landing/recovery. No reconciler state, branch ownership or other workers were changed.
