---
stage: "idea"
assignee: "agent"
priority: 2
author: "session:thr_pin7e2fczg"
---
On 2026-11-24 the concept supervisor (@thread:thr_ihbpyrp6s2) superseded reconciler state by hand several times, because the reconciler has no supported way to say "this attempt or checkpoint is superseded":

- **Repeated-implementation guard ignores the contract.** `admitImplementation` ([reconcile.ts](../../lib/reconcile/reconcile.ts) ~755–770) keys attempts on base commit and prerequisites only. After two rulings changed the `base-ref-tree-shaking` and `core-sparse-three-phase-resolution` contracts, the supervisor cleared the attempt records with the reconciler stopped (@thread:thr_ihbpyrp6s2#msg=78206), then made a docs-only base commit `d30d2c86bb` with hooks skipped just to change the key (#msg=79672). A recorded constraint or contract revision should count as a changed input.
- **Superseded checkpoints are required as ancestors.** [launch-base.ts](../../lib/reconcile/launch-base.ts) ~52–60 treats ancestry as "already carried". To launch past stale recording checkpoints the supervisor made `ours`-strategy merges listing them as parents (concept `381ab2423e`, `35a6b5a77a` with eight; #msg=73927, #msg=75267). `35a6b5a77a`'s tree equals its first parent while parent `d3867915d2` differs in nine recording files, so git now claims content that isn't there. "Answer without commit" only surfaced the next checkpoint each time (#msg=73888, #msg=83621), and once discarded a qualified attempt that had to be recovered (#msg=73982).
- **Ledger landings come back.** Removing `landed` and `results` for four stale re-record groups didn't hold: `recoverLandings` rebuilt them from `landingOps` ([completion.ts](../../lib/reconcile/completion.ts) ~81–85, 170–176) until all three were removed with the reconciler stopped (#msg=73669, #msg=76249). This is the residual [[projects/mlegls-pi/issues/reconciler-never-reenters-a-reopened-landed-node]] left as "Not done".

Wanted: a `reconcile_resolve` action that supersedes a node's attempts, checkpoints or landing: admits one new attempt, keeps chosen checkpoints, marks the rest ineligible without making them ancestors, and leaves the old landing receipt visible but not recoverable, across restarts. Found by the 2026-11-25 concept adversarial review (concept @thread:thr_pin7e2fczg, reviewers @thread:thr_8a3jmj2sue and @thread:thr_qiubmzr9d4).
