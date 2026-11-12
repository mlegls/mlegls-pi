---
stage: "ticket"
assignee: "agent:auto-routine"
priority: 2
author: "session:01a1ce05-15a3-7191-b6d9-27abd097297f"
part-of: "[[projects/mlegls-pi/issues/a-name-is-an-agent-with-its-soul-skills-and-life]]"
claimed-by: "reconcile:a-name-is-an-agent-with-its-soul-skills-and-life"
blocked-by:
  - "[[projects/mlegls-pi/issues/named-agent-runtime]]"
---
goal: someone can try the named-agent story in two terminal sessions and a BB thread from an isolated fixture registry, beside the life's existing first-use entry point. This is the fixture first use in [[projects/mlegls-pi/issues/a-name-is-an-agent-with-its-soul-skills-and-life#shape]].

## shape

Extend [life-playground.ts](../../scripts/life-playground.ts) and the [life guide](../../extensions/context/life/README.md) with one fixture agent and one private skill. Load the checkout's agents, stances, context and system-prompt extensions in their required order. Use the playground's isolated store and project settings: global notes remain disabled, and the fixture is registered only in the disposable workspace. Give the fixture a credentialed model suitable for this encounter, not Concept Engineering's trial model by accident.

Record first use: `pi --model agent/<fixture>` answers in the soul's terms, lists its skill, has `note` despite disabled notes settings, and appears in the life's present. A second session on another model has neither soul nor skill nor `note`; `/life /<fixture>` makes it the same agent, and `/life off` ends it. A skill-description edit in one appears in the other's next run; `/memory -notes` works. Selecting the agent model after messages attaches nothing. Confirm that changing the model while attached keeps the identity and that an ordinary stance worker without `PI_LIFE` has no agent identity. Exercise inherited attachment through resume/fork using the life's existing entry point.

Repeat startup from a BB thread using `agent/<fixture>`: BB sets the model after pi starts, so observing terminal startup alone leaves this path unchecked. Confirm the virtual model in `bb provider models pi`, which also supplies the automation model selector. The BB slash-command workaround, if still needed, is already in the linked guide.

Write the runnable guide alongside the encounter and keep its evidence under this ticket's packet. This is a usable fixture and first-use record, not a new test suite.
