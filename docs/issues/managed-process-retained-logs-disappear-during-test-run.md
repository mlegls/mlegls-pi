---
stage: idea
author: "session:ccea9429-e217-4757-b9bc-ea647fbf07f0"
---

While verifying SCM's `settle-through-arkhai-payments` (VM storefront unit/integration suites), the process tool reported completion but could not read its retained logs. `process output` for the same process returned `Could not read output for: proc_10`. Other process records in the same session remained readable. This happened on `convergence-checks`, `import-regressions`, and `vm-import-recheck`; a repeat captured through `tee .wm/vm-check.log` retained its 895 unit passes (one skipped) and 152 integration passes.

Owner: pi process log retention. The cause is not established; test cleanup may be involved. Workaround: tee long checks into a worktree-owned file and record summarized final evidence. Investigate why a still-retained process record can point to missing log files, and preserve enough final output to diagnose failure even when retention is lost.
