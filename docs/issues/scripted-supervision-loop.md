---
stage: idea
assignee: human
author: session:01a0cc04-cb45-71a4-b0d6-737d08a9055c
priority: 3
---

Script the supervisor's scheduling loop, waking an LLM only for judgment. The implementation flow is quite algorithmic: wait for any child, merge on `done`, compute the next ready set from dependencies, dispatch within budget. That is mechanical. It's Erlang/OTP supervision, or a durable-workflow engine like Temporal, and the name `supervise` is already borrowing from there. An event loop that wakes an LLM only on `needs-input`, `blocked`, merge conflicts or verification findings would make intermediate supervisors almost free, and cheap supervisors are what make deep trees affordable.

This would cleanly separate implementation from getting to tickets, and mechanically enforce that getting to tickets is the freeform, interactive part, and execution much less so and process-bound.

Scripts fit where the LLM step really is f(text) → text: small closed input, typed output, a judgment that doesn't depend on the surrounding situation. Autoread felt bad because its boundary cut through the middle of an activity that is judgment all the way through. The move that worked was turning the decision tree into data: stage, assignee, `part-of` and `blocked-by` encode the branching; deterministic code interprets it (`route.prepare`, frontier, `views`); Jev decides small self-contained questions; sessions execute the leaves. Rule of thumb: script the edges between sessions and per-item judgments over many items; leave anything inside one context to skills.

Promising once the ticket system matures. Don't build it until live runs of the `supervise` skill show supervisor tokens going to scheduling rather than judgment. The pieces (frontier, `dispatch`, `waitForFinish`) are already in `lib/`.
