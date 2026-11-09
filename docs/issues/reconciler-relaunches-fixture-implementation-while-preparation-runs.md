---
stage: "idea"
assignee: "agent"
author: "session:thr_sv764kn5dz"
priority: 2
---
Owner: mlegls-pi reconciler. During [[projects/concept/issues/restore-the-5000-card-fixture-from-a-snapshot]], implementation worker @thread:thr_k7tww2jhsm (`implement-23`) reported `waiting — prepare-current-5000-card-fixture` on its managed cold import, commit `54e6f952c`, target `http://127.0.0.1:3232`. Successive implementations through `implement-2d` were nevertheless launched on the same base `493b2c819`.

At 2026-11-09 16:31 +08, `implement-2d` found the original fixture process still alive (PID 1894457, cwd ending `restore-the-5000-card-fixture-from-a-snapshot-implement-23`), its import receipt still progressing and the shared cache lock for `f1af2f9621d1a16f28dc0246ae8ea176d9bb26dd52199f6cb3bc8fe3dae91672` still held. `bb thread log` retains the original plain `waiting` report; `bb thread list` shows the later same-parent implementations. No failure of that cold preparation was observed. This resembles [[projects/mlegls-pi/issues/reconciler-drive-continuation-loses-managed-process-ownership]], whose result says plain waiting is supported.

Workaround in @thread:thr_sv764kn5dz: recover the committed implementation, leave the original preparation and lock untouched, and observe its eventual cache publication before restoring into this checkout's distinct target. This avoids a second cold import; it does not explain the redispatches. Investigate why the running implementation was relaunched after its plain waiting report.
