---
name: advance
description: "Use to move ideas toward agent-ready tickets, in a given scope or across the project's pre-ticket work."
disable-model-invocation: true
argument-hint: "issues or a subtree, or nothing for the project"
---

Advancing spends the user's attention; supervision spends compute. Aim for the most tickets per decision. Read the scope first (`orient`; the whole tracker when unscoped).

1. Triage. Settle what needs no human by the tracker's triage questions (`tracker` lifecycle reference): fulfilled or superseded issues, mechanical stage, parent and blocker fixes, discoverable facts. An issue with an in-flight claim is judged by the branch that holds it, not by main; leave edits to files a live branch changes until it merges. Commit those. Put the remaining decisions to the user in one batch, each with a recommendation and what it unlocks, ordered by issues made ready per decision, so one reply ("defaults except 3 and 7") settles it; past about fifteen, make it a `lavish-axi` input page (`lavish-axi playbook input`). An issue whose user and situation can't be named is a decision, not a ticket. Apply the answers.
2. Areas, when unscoped. Group what remains before ticket into areas (index pages where they fit, otherwise stories or code areas) ranked by importance and leverage, each with an appetite (what it's worth, not what it costs) and a subtree disjoint from the others. Return them and stop: the user picks, often forking a session per area.
3. Shape each chosen scope (`shape`).

Return the new tickets for `supervise` and what still needs the user.
