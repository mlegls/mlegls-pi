---
stage: idea
author: "session:01a0f8a9-9b80-77f1-a2f0-bb5399a3792c"
---

During [[projects/concept/issues/reconcile-folded-browser-scenarios-on-the-common-seed]], worker `implement-1e` was launched in a new worktree/session from `implement-1d`'s checkpoint while the original 124-case browser batch and its services remained alive. The checkpoint instructed the continuation to await managed `proc_10`'s automatic completion notification. `process logs proc_10` instead returned `Process not found: proc_10. No processes have been started in this session.` The running Playwright PID and report directory still belonged to `implement-1d`; the continuation had none of its ignored deployment/build/report state.

Owner: reconciler checkpoint handoff and the pi process tool's session-local ownership. No lost batch or service is established. Workaround: confirm the original checkout/config/readiness and exact live process, preserve its run without reseeding, then start a managed Node `fs.watch` observer for its completed report file in the continuation session. The observer supplies the continuation's completion notification; results are committed on the continuation branch. Cleanup must still explicitly stop the inherited checkout's services.

Consider a checkpoint handoff that carries an observable durable completion/log endpoint, or explicitly transfers its process notification subscription. A session-local `proc_N` alone is not a runnable continuation instruction. [[projects/concept/issues/attachments/browser-replay-rulings/combined|Encounter and common-seed packet]].
