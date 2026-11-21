---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:01a1cb82-e72e-7098-88b1-3f12d6a5028f"
priority: 2
---
During [[projects/concept/issues/tutor-turn-claim-exhausts-occ-against-theory-delivery]], @thread:thr_7v3bxmdzjb repeatedly received the reconciler's “You reported `waiting`, but your session runs no managed process” nudge while its named process was still running. On 2026-11-12, `process wait claim-current-cloud-setup` returned running with advancing import output; it subsequently completed successfully after 11m35s. The next full-startup process (`claim-current-full-startup`, proc_27, PID 2949347) received the same nudge and `process wait` again returned running, subsequently advancing through ready, setup close and first scripted action. No process was restarted or lost.

Owner: mlegls-pi reconciler's waiting-void detection. Workaround: inspect the existing named process with `process wait` and continue it unchanged; do not restart an owned Cloud encounter based only on the nudge. Two false wakes add turns during a long, intentionally idle encounter. Cause is unestablished. The earlier counter-observation in [[projects/mlegls-pi/issues/waiting-worker-loses-managed-process-registry-and-provider]] is the same symptom; the waiting-void detector was introduced in [[projects/mlegls-pi/issues/managed-process-completion-notice-did-not-reach-a-waiting-worker]]. This is a false absence report, separate from loss of a process registry or delayed completion notifications.
