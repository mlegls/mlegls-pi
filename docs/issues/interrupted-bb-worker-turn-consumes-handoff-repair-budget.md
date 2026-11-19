---
stage: "idea"
author: "session:thr_iyjqmze9yv"
assignee: "agent"
priority: 3
---
During Concept's `enter-a-chat-session-on-its-mission` run on 2026-11-19, @thread:thr_ujfyn282kd was interrupted three times while implementing the web-host ticket. The BB log pairs `Pi run interrupted unexpectedly; no automatic resume was attempted` with failed `turn/completed` events (seq 1447–1448, 2663–2664 and 3730–3731). The reconciler asked for an unambiguous status with `First nonblank line: (empty report)`. The first two nudges recovered valid checkpoints and resumed work. The third interruption escalated as `status (after 2 repairs)` with an empty report, even though the worker had left a clean, committed checkpoint.

The handler recovered the task state from the tracker and the worker branch. Could failed BB turns use interruption recovery from the preserved checkout and last checkpoint, with the actual error in any escalation? Keep the status-repair budget for a completed turn that lacks a parseable handoff. Unlike [[projects/mlegls-pi/issues/reconciler-misses-status-from-completed-turn-event]], the turns that triggered the nudges here ended in failure, with no valid final handoff to recover from those turns.
