---
stage: "done"
assignee: "agent"
author: "session:01a1863c-c488-76f5-9cd2-1f0ef378e140"
---
Observed 2026-10-28 in arkhai-payments (tree hosted-dispute-lifecycle, owner @thread:thr_b8zcwpysi2). The scheduled-stops implementer (session 01a181cc-0bc8-700e-a2f6-43a15fe7782c) wrote `claimed-by: session:01a181cc-…` on its own ticket through the tracker (99b6d26, "tracker: update scheduled-stops"), following the vault procedure's "claim before anything else". Its work landed in tree/per-part-lifecycle and it was retired, but the claim stayed: the reconciler stopped with "per-part-lifecycle: scheduled-stops claimed by session:01a181cc-…" and launched nothing until the owner cleared it by hand. The same happened in dispute-authority: mediation-contract kept its landing worker's claim after it landed.

Expected: a claim written by one of the run's own workers is the run's, and landing or retiring the worker releases it.

## Result

The reconciler records each of its live workers' pi sessions (`State.workerSessions`, from the pi-live records of threads titled `<root>/…` in the repository). Their `session:<id>` claims are ignored by its scheduling view like its attempt tokens, and each tick clears `claimed-by` on any issue whose every stored claim belongs to a retired (archived or gone) worker of the run. Workers' common prompt now says the issue they were launched for is reserved by their parent, so they shouldn't claim it (2ee4f3a3). A claim written before the reconciler saw the worker's session stays foreign.
