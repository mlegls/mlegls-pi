---
assignee: agent
author: session:01a0cc04-cb45-71a4-b0d6-737d08a9055c
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
priority: 3
---

Script the supervisor's scheduling loop, waking an LLM only for judgment. The implementation flow is quite algorithmic: wait for any child, merge on `done`, compute the next ready set from dependencies, dispatch within budget. That is mechanical. It's Erlang/OTP supervision, or a durable-workflow engine like Temporal, and the name `supervise` is already borrowing from there. An event loop that wakes an LLM only on `needs-input`, `blocked`, merge conflicts or verification findings would make intermediate supervisors almost free, and cheap supervisors are what make deep trees affordable.

This would cleanly separate implementation from getting to tickets, and mechanically enforce that getting to tickets is the freeform, interactive part, and execution much less so and process-bound.

Scripts fit where the LLM step really is f(text) → text: small closed input, typed output, a judgment that doesn't depend on the surrounding situation. Rule of thumb: script the edges between sessions and per-item judgments over many items; leave anything inside one context to skills.

The gate was live runs of the `supervise` skill; the 2026-09-23 concept campaign is that run: [[projects/mlegls-pi/research/orchestration-audit-2026-09-23]]. Coordination was ~49% of ~$252, mostly supervisor cache reads; supervisors ran as design-owning `auto` sol workers, reviewed sibling code, commissioned implementer tests; the root took 420 inbound messages (5 terminal reports) and narrated 317 times while the human was away.

substeps: [[projects/mlegls-pi/issues/ab-daemon]], [[projects/mlegls-pi/issues/host-child-events]] and [[projects/mlegls-pi/issues/worker-turn-end-report]] in parallel; then [[projects/mlegls-pi/issues/supervision-phase-loop]]; then [[projects/mlegls-pi/issues/supervise-as-exception-handler]].

decisions:
- 2026-09-23: the script owns the loop. It runs in an `ab` daemon; the library lives in `lib/` (successor to `lib/supervise.ts`, which is workmux/board-bound).
- 2026-09-23: children are created with the owning LLM agent as parent, so every session shows in Paseo (or whichever host) as today. Paseo's `notifyOnFinish` is MCP-only; SDK-created children never wake the parent, so the daemon owns every finish event.
- 2026-09-23: the owning LLM is woken only by the daemon, on an exception. Routine transitions never reach it; progress notes don't exist.
- 2026-09-23: implement → verify → integrate needs no LLM step when Jev gates pass. The verifier is launched under the supervisor, not the implementer. Any caveat in a handoff wakes the LLM at first; relax with data.
- 2026-09-23: workers signal by ending the turn. A first-word sentinel (`done`, `blocked`, `needs-input`) plus a structured handoff block found anywhere in the last message; schema output isn't expected pure (fences, preamble).
- 2026-09-23: no review step; lints, including Jev lints, suffice. Review would be another step beside verify.
- 2026-09-23: exception handling: steer if simple, answer from context, or consult a frontier oracle; solved ones go to the child and nobody else. Otherwise escalate. The interactive root differs only in reporting status when asked and escalating to the human.
- 2026-09-23: `supervise` operating point is GLM 5.3 Flash high on trial, opus 5.5 medium if it can't hold the process (`869e6a7`).

holes:
- Jev preflight lint on assignment prompts in `dispatch` (checklist-commissioned tests, wrong stance, audit inside hacking). Wanted by the loop's templated assignments too.
- pinning the roster per campaign, or linting that "start with `X`" names an existing skill: the stance files changed mid-campaign.
- verifier environments are the main block (ports, deployments, sign-in); project-side, e.g. a concept `verify:env` task with isolated ports and a signed-in `storageState`.

shape:

```
start:        tracker frontier → Jev stance per ticket (routing.md) → dispatch within budget
              (don't parallelize sibling subtrees when one is blocked by the other's unfinished children)
child done:   implement → verify (same branch and setup) → integrate (merge + lints incl. Jev) → next frontier
exception:    blocked / needs-input / no sentinel / error / checkpoint / verify failed / conflict / lint fail
              → wake owner with ticket + recorded decisions + report excerpt
              owner: steer | answer | oracle → send to child; else escalate
subtree done: one crossing-story verify if Jev sees crossings → single report up
```
