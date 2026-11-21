---
stage: "done"
assignee: "agent:auto-routine"
author: "session:01a1cb82-e72e-7098-88b1-3f12d6a5028f"
priority: 2
---
During [[projects/concept/issues/tutor-turn-claim-exhausts-occ-against-theory-delivery]], @thread:thr_7v3bxmdzjb repeatedly received the reconciler's “You reported `waiting`, but your session runs no managed process” nudge while its named process was still running. On 2026-11-12, `process wait claim-current-cloud-setup` returned running with advancing import output; it subsequently completed successfully after 11m35s. The next full-startup process (`claim-current-full-startup`, proc_27, PID 2949347) received the same nudge and `process wait` again returned running, subsequently advancing through ready, setup close and first scripted action. No process was restarted or lost.

Owner: mlegls-pi reconciler's waiting-void detection. Workaround: inspect the existing named process with `process wait` and continue it unchanged; do not restart an owned Cloud encounter based only on the nudge. Two false wakes add turns during a long, intentionally idle encounter. Cause is unestablished. The earlier counter-observation in [[projects/mlegls-pi/issues/waiting-worker-loses-managed-process-registry-and-provider]] is the same symptom; the waiting-void detector was introduced in [[projects/mlegls-pi/issues/managed-process-completion-notice-did-not-reach-a-waiting-worker]]. This is a false absence report, separate from loss of a process registry or delayed completion notifications.

## Result

done — only the exited receipt triggered an early nudge. The ordinary 30-minute check-in now also directs the worker to `process wait`. Replayed all four inboxes after the edit; `lib/reconcile/exceptions.test.ts` passed 7/7.

```yaml
commit: 11649ff5
stories:
  - story: A waiting worker with a running process receives no early nudge.
    outcome: held
  - story: An unknown process state does not trigger an early absence report.
    outcome: held
  - story: A terminal process receipt triggers one early nudge.
    outcome: held
  - story: A missing receipt still permits the ordinary 30-minute check-in.
    outcome: held
evidence:
  path: docs/attachments/reconciler-waiting-void-nudge-misses-live-managed-process/index.md
  visual: false
  shots: []
fixed:
  - Replaced process list/output advice in the ordinary check-in with process wait on the named process.
tests: []
filed: []
caveats:
  - The replay uses seeded receipts, backdated waits, and a simulated BB inbox. It verifies the nudge decision and wording, not live BB delivery.
```

Evidence: [docs/attachments/reconciler-waiting-void-nudge-misses-live-managed-process/index.md](../attachments/reconciler-waiting-void-nudge-misses-live-managed-process/index.md)
