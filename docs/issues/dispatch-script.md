---
next: implement
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

dispatch steps 2–6 as one `decide` call over (ticket, map output): plan / implement here / do it / compile / orchestrate, plus executor class. low confidence → `needs-input`. keep "warm context worth more than handoff" out of jev; that is the parent's call. the fence rule for workers changes from context fraction to cumulative cache-read tokens (the audit's cost driver), with respawn-from-ticket as the default at the fence.

done: dispatch's prose reduced to what the script cannot decide; the script's choices logged so "[[projects/mlegls-pi/issues/orchestration-audits]]" can check them against outcomes.
