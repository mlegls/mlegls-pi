---
stage: ticket
assignee: agent
author: "session:ccea9429-e217-4757-b9bc-ea647fbf07f0"
---

Done: in `~/dev/pi-processes`, when a completion notice or `process output` cannot read a log, it says why (error code and path), and the process record keeps that error. A test makes the read fail and checks the notice. The silent catch is upstream code (mjakl/pi-processes 2.5.0), so this goes as its own PR there. The fix for the underlying failure is a later ticket once a recurrence or repro shows the code.

While verifying SCM's `settle-through-arkhai-payments` (VM storefront unit/integration suites), the process tool reported completion but could not read its retained logs. `process output` for the same process returned `Could not read output for: proc_10`. Other process records in the same session remained readable. This happened on `convergence-checks`, `import-regressions`, and `vm-import-recheck`; a repeat captured through `tee .wm/vm-check.log` retained its 895 unit passes (one skipped) and 152 integration passes.

2026-10-05, SCM `route-settlement-by-mechanism` VM delivery implementation (`014844f1-2c49-44fe-9d07-9e638afcc1b1`): `vm-focused` completed with exit 1 and the automatic notice said its retained logs could not be read. `process logs` still returned paths; `grep` on stdout recovered four failing tests and 204 passes. No rerun was needed to recover the failure details. This encounter does not establish that the files disappeared; the failure may instead be notification-time log reading.

2026-10-05, SCM joined closeout (`b8255ce4-665a-4d56-80ad-5a8a5e67dadb`): `vm-storefront-focused` completed successfully but its automatic notice said recent output was unavailable because logs could not be read. `process logs` returned the retained paths; `read` immediately recovered `244 passed, 1 warning in 23.87s` from stdout. No rerun or tee was necessary. This again establishes notification-time read failure, not disappearance of the files. Evidence: SCM `docs/attachments/route-settlement-closeout/index.md`.

Owner: pi process log retention. The cause is not established; test cleanup may be involved. Workaround: tee long checks into a worktree-owned file and record summarized final evidence. Investigate why a still-retained process record can point to missing log files, and preserve enough final output to diagnose failure even when retention is lost.

2026-10-08: the process tool is the local fork `~/dev/pi-processes`. The notice's "logs could not be read" is `readTailLines` (`src/utils/log-files.ts:396`) returning `null` from a catch that drops the error. Next: record the error (code and path) in the notice and the process record, then reproduce with output large enough to make the bounded log discard old bytes during a long run, or wait for a recurrence. No decision is pending until the error is known.
