---
name: advance
description: "Use to make progress on an issue, subtree, or project."
disable-model-invocation: true
argument-hint: "issues or a subtree, or nothing for the project"
---

Advancing spends the user's attention; execution spends compute, in a separate supervision session so this one stays interactive. Aim for the most ready work per decision. Read the scope first (`orient`; the whole tracker when unscoped): its effective stage, claims, and what blocks it or waits on it.

Then by where it stands:

- In flight: read its tracker contract and `reconcile_status`. What it waits on from the user goes to its owner's bb thread; don't resolve it from here.
- Agent-ready spec or ticket: the tracker is the handoff; the project's pickup (`supervise`) takes ready trees in its scope, so don't message the supervisor that work is ready. Check `pickup_status`: if pickup is off or the tree is outside its scope, say so in the return rather than starting a supervisor. Tell the supervisor in `desk/ROLES.md` only a changed contract of a tree it is already running.
- Done: check the result against what it was for, and file what it surfaced.
- Not ready (idea or goal, a human assignee, or blocked by such):
  1. Triage, human- and agent-assigned alike (`tracker` lifecycle). Settle what needs no human (fulfilled/superseded, mechanical stage, parent/blocker fixes, discoverable facts); leave in-flight writes to their owner. Put the remaining decisions to the user in one batch, each with a recommendation and what it unlocks, ordered by issues made ready per decision, so one reply ("defaults except 3 and 7") settles it; past about fifteen, make it a `lavish-axi` input page (`lavish-axi playbook input`). An issue whose user and situation can't be named is a decision, not a ticket. Flag possible misassignments (`tracker` lifecycle, assignment) with why and what reassigning would do; flagged issues wait for the answer. Apply the answers.
  2. Agent-assigned: shape them directly to agent-ready (step 4). A question only the user can answer goes in the batch; it is not decided for them.
  3. Human-assigned, when unscoped: group them into areas (index pages where they fit, otherwise stories or code areas) ranked by importance and leverage, each with an appetite (what it's worth, not what it costs) and a subtree disjoint from the others. Return them: the user picks, often forking a session per area, and shapes it interactively.
  4. Shape each scope until it is agent-ready (`shape`). A spec is enough unless this session holds context that would make better tickets now than the reconciler's fresh decomposition later; then write the tickets. What comes out agent-ready is handed over as above.

Return what is ready for pickup, anything pickup won't take, and what still needs the user.
