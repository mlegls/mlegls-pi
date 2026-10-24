---
name: advance
description: "Use to make progress on an issue or scope by its status and the rest of the tracker: shape what isn't ready, hand what is to an execution supervisor."
disable-model-invocation: true
argument-hint: "issues or a subtree, or nothing for the project"
---

Advancing spends the user's attention; execution spends compute, in a separate supervision session so this one stays interactive. Aim for the most ready work per decision. Read the scope first (`orient`; the whole tracker when unscoped): its effective stage, claims, and what blocks it or waits on it.

Then by where it stands:

- In flight: read its global tracker contract and landing ledger (`reconcile_status`); the claim's branch holds code/evidence, not issue state. What it waits on from the user goes to its owner's bb thread; don't resolve it from here.
- Agent-ready spec or ticket: send the issues with `bb thread tell <thread> --mode queue` to the supervisor in the main checkout's `desk/ROLES.md`. If none is live, start a bb supervision thread in the main checkout running `/skill:tend <issues>`. Ready blockers go with them.
- Done: check the result against what it was for, and file what it surfaced.
- Not ready (idea or goal, a human assignee, or blocked by such):
  1. Triage, human- and agent-assigned alike. Settle what needs no human by the tracker's triage questions (`tracker` lifecycle reference): fulfilled or superseded issues, mechanical stage, parent and blocker fixes, discoverable facts. An in-flight issue's contract is global; inspect its owner's landing ledger and code/evidence branch for progress, and leave its writes to that owner. Apply triage through the tracker, not branch issue commits. Put the remaining decisions to the user in one batch, each with a recommendation and what it unlocks, ordered by issues made ready per decision, so one reply ("defaults except 3 and 7") settles it; past about fifteen, make it a `lavish-axi` input page (`lavish-axi playbook input`). An issue whose user and situation can't be named is a decision, not a ticket. The batch also flags possible misassignments (`tracker` lifecycle, assignment): an agent-assigned issue that isn't fully decided, such as one nobody has chosen to pursue, or a human-assigned one already settled enough for agents. Each says why and what reassigning it would do; a flagged issue waits for the answer. Apply the answers.
  2. Agent-assigned: shape them directly to agent-ready (step 4). A question only the user can answer goes in the batch; it is not decided for them.
  3. Human-assigned, when unscoped: group them into areas (index pages where they fit, otherwise stories or code areas) ranked by importance and leverage, each with an appetite (what it's worth, not what it costs) and a subtree disjoint from the others. Return them: the user picks, often forking a session per area, and shapes it interactively.
  4. Shape each scope until it is agent-ready (`shape`). A spec is enough unless this session holds context that would make better tickets now than the reconciler's fresh decomposition later; then write the tickets. What comes out agent-ready is handed over as above.

Return what went to the supervisor and what still needs the user.
