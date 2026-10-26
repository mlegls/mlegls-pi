---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:thr_zgjve7mckq"
---
idea: the efficiency audit of 2026-10-26 (@thread:thr_zgjve7mckq; auditor @thread:thr_ztepcfseav) counted 181 supervisor turns in 10-22→10-26, about $31, spent on "retired … kept ignored state" notices. Supervisors answered them with 625 `rm -rf` cleanups and restored kept state 3 times. 78 `~/dev/mmon/concept__retired` directories hold 7.1 GB. The maintainer agreed to quieter notices and pruning, provided retirement keeps what a worker declared: [[projects/mlegls-pi/issues/finished-worker-retirement-discards-retained-ignored-state]] records a paid run's `.convex` deployment lost by discarding, so marking `.convex` disposable is not the fix.

ticket: retirement keeps every path a worker's handoff names, finished or not (the linked ticket), and treats the rest of the kept ignored state as routine. Routine kept state goes to the reconciler log and `RETIRED.md`, not to a supervisor turn; the owner is told only when a kept path was declared in the handoff or is otherwise not routine setup output. A `__retired` directory is pruned once its branch is merged into its target and nothing in it was declared. Code lives in `lib/reconcile/reconcile.ts` and `lib/thread/lifecycle-cleanup.ts`.

Acceptance: a test retires a finished worker holding a declared `.captures/x` and undeclared `node_modules`-style setup output. The owner gets one notice naming `.captures/x` and none for the setup output. After the branch merges, the prune removes a `__retired` directory holding only routine state and keeps the one holding `.captures/x`.

Verification packet: [acceptance encounter](../../docs/attachments/retirement-notices-and-retired-checkouts-pile-up/index.md).
