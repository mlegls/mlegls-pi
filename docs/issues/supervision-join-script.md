---
next: implement
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

orchestrate steps 3–4 as a workflow script: wait → merge → test → classify the outcome with jev {clean, needs-merge-attention, needs-decision, respawn} → handle the first, second, and fourth in the script; only needs-decision wakes the coordinator, carrying a jev-selected excerpt (later the "[[projects/mlegls-pi/issues/skim-and-triage]]" rendering). on checkpoint, default to respawn from the ticket rather than steering: dispatch already prescribes this and the audit shows it was not done (9 topics checkpointed ≥2×, the same handles as the top-cost sessions).

done: a run supervised end to end by the script with the coordinator receiving decisions only; coordinator after-spawn ingress measured against the audit's 18.6 MB / $2134 baseline.

holes:
- the ask fallback: how the script blocks on the coordinator's answer. shared with "[[projects/mlegls-pi/issues/decide-primitive]]".
- merge conflicts still go back to the worker via `send`; the script owns that loop.
