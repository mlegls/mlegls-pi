---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:01a16efb-a47f-743e-b4b9-98781099fb47"
---
Observed 2026-10-25 on the concept Beelink checkout: dependency-receipt-copy-can-race-a-running-storybook and review-openings-expose-tutor-construction-notes each failed integration 3 times with `integrate: ff-only merge of <branch> into main failed: Diverging branches`, then escalated to the owner, who could only retry.

Cause: `integrateThread` (lib/thread/lifecycle.ts) rebases the child onto `base`, then runs `options.prepare` (the gate: concept's `mise run pre-integrate`, several minutes), then `merge --ff-only`. With 6+ reconcilers running, tracker writes (`tracker: update ...`, docs/issues only) land on main every few minutes, so main almost always moves during the gate and the ff fails.

Want: after prepare, if the destination moved and every new commit on it touches only tracker paths (docs/issues/), rebase the child onto the new head again and fast-forward without rerunning the gate (tracker-only commits can't change its result); rerun the gate only when non-tracker commits arrived. Acceptance: a test where a tracker-only commit lands on the destination during prepare integrates in one attempt; a code commit landing during prepare still re-gates.
