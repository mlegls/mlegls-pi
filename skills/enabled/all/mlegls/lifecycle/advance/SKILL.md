---
name: advance
description: "Use to make progress on an issue or scope by its status and the rest of the tracker: shape what isn't ready, hand what is to an execution supervisor."
disable-model-invocation: true
argument-hint: "issues or a subtree, or nothing for the project"
---

Advancing spends the user's attention; execution spends compute, in a separate supervision session so this one stays interactive. Aim for the most ready work per decision. Read the scope first (`orient`; the whole tracker when unscoped): its effective stage, claims, and what blocks it or waits on it.

Then by where it stands:

- In flight: read where it stands (`reconcile_status`, the claim's branch). What it waits on from the user goes to its owner by `mail`; don't resolve it from here.
- Agent-ready spec or ticket: hand it to the execution supervisor. If one is running for this project (an owner in `reconcile_status`), mail it the issues; otherwise spawn one in the main checkout: `cyber-mux open --cwd <checkout> --label supervise --launch 'pi "/skill:tend <issues>"'`. Ready blockers go with them.
- Done: check the result against what it was for, and file what it surfaced.
- Not ready (idea or goal, a human assignee, or blocked by such):
  1. Triage. Settle what needs no human by the tracker's triage questions (`tracker` lifecycle reference): fulfilled or superseded issues, mechanical stage, parent and blocker fixes, discoverable facts. An issue with an in-flight claim is judged by the branch that holds it, not by main; leave edits to files a live branch changes until it merges. Commit those. Put the remaining decisions to the user in one batch, each with a recommendation and what it unlocks, ordered by issues made ready per decision, so one reply ("defaults except 3 and 7") settles it; past about fifteen, make it a `lavish-axi` input page (`lavish-axi playbook input`). An issue whose user and situation can't be named is a decision, not a ticket. Apply the answers.
  2. Areas, when unscoped. Group what remains before spec into areas (index pages where they fit, otherwise stories or code areas) ranked by importance and leverage, each with an appetite (what it's worth, not what it costs) and a subtree disjoint from the others. Return them and stop: the user picks, often forking a session per area.
  3. Shape each chosen scope to spec (`shape`); decomposing a spec into tickets is the reconciler's. What comes out agent-ready is handed over as above.

Return what went to the supervisor and what still needs the user.
