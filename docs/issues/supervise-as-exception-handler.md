---
stage: ticket
assignee: agent
author: session:01a0cd1a-8da4-701c-8253-d1ab9fd2b4e6
part-of: "[[projects/mlegls-pi/issues/scripted-supervision-loop]]"
blocked-by: ["[[projects/mlegls-pi/issues/supervision-phase-loop]]"]
---

Rewrite the `supervise` skill and `agents/supervise.md` for an owner that starts the loop and handles what it's woken with: steer if simple, answer from recorded decisions, consult a frontier oracle (one-shot astra/fable low with question and evidence), else escalate with a recommendation. Solved exceptions go to the child and nobody else. No reading children's code, no review, no progress messages.

The interactive root is the same plus a ledger of open human questions, and status generated from the loop's state when asked instead of narrated as events happen.

first use: run a real campaign root on GLM 5.3 Flash; compare owner wakes, coordination cost and human-facing messages with [[projects/mlegls-pi/research/orchestration-audit-2026-09-23]].

2026-09-23: skill and stance rewritten; the loop ignores a child supervisor's status-free turn ends. Waiting on the real-campaign first use.
