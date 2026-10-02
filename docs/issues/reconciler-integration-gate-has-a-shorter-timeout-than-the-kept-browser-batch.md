---
stage: idea
assignee: agent
author: session:86d24b04-f507-431f-be52-5c33b3e2f361
---

During [[projects/concept/issues/gate-supervised-integration-on-the-kept-browser-batch]], inspected the installed integration path before starting the complete kept replay. `lib/reconcile/reconcile.ts`'s `land` runs the declared project gate with `execFileSync(... timeout: 30 * 60_000)` after the integration rebase and before closure/fast-forward. No per-project timeout input is exposed by `reconcile`.

Concept's committed fresh-seed command is `bun run test:browser`. Its prior complete Application replay alone took 30.3 minutes, in addition to setup, Chromium, packaged builds, readiness and seeding; the project gate also runs existing checks and unit tests. [[projects/concept/attachments/run-the-kept-browser-batch-on-a-fresh-seed-with-one-command/index|Runner receipt]]. The configured integration command cannot accommodate that observed duration. No integration timeout has been executed or reproduced in this encounter; this is a located hard bound versus recorded runtime, not a failed-browser claim.

`ab supervise start <ticket> --test CMD`, named by the Concept ticket, is also absent in this installation: `ab supervise --help` exits 1 with `usage: ab tree [ui|sidebar|open|send] ... | ab timeline [SESSION]`. The current reconciler discovers `mise run pre-integrate` through `lib/reconcile/checks.ts:declaredGate`, independent of reviewer-listed files. Updating Concept's task to include the fresh-seed batch is the project-side workaround for the retired invocation, but not for the timeout.

Asked the Concept supervising owner to authorize the current declared-gate entry and arrange a timeout repair at the harness owner before attempting supervised integration. A hand-selected subset, pre-rebase run or manual fast-forward would not meet the browser ticket. No global supervisor change is authorized in that ticket. Relevant owner: [[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]].
