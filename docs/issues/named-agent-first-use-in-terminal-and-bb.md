---
stage: "done"
assignee: "agent:auto-routine"
priority: 2
author: "session:01a1ce05-15a3-7191-b6d9-27abd097297f"
part-of: "[[projects/mlegls-pi/issues/a-name-is-an-agent-with-its-soul-skills-and-life]]"
---
goal: someone can try the named-agent story in two terminal sessions and a BB thread from an isolated fixture registry, beside the life's existing first-use entry point. This is the fixture first use in [[projects/mlegls-pi/issues/a-name-is-an-agent-with-its-soul-skills-and-life#shape]].

## shape

Extend [life-playground.ts](../../scripts/life-playground.ts) and the [life guide](../../extensions/context/life/README.md) with one fixture agent and one private skill. Load the checkout's agents, stances, context and system-prompt extensions in their required order. Use the playground's isolated store and project settings: global notes remain disabled, and the fixture is registered only in the disposable workspace. Give the fixture a credentialed model suitable for this encounter, not Concept Engineering's trial model by accident.

Record first use: `pi --model agent/<fixture>` answers in the soul's terms, lists its skill, has `note` despite disabled notes settings, and appears in the life's present. A second session on another model has neither soul nor skill nor `note`; `/life /<fixture>` makes it the same agent, and `/life off` ends it. A skill-description edit in one appears in the other's next run; `/memory -notes` works. Selecting the agent model after messages attaches nothing. Confirm that changing the model while attached keeps the identity and that an ordinary stance worker without `PI_LIFE` has no agent identity. Exercise inherited attachment through resume/fork using the life's existing entry point.

Repeat startup from a BB thread using `agent/<fixture>`: BB sets the model after pi starts, so observing terminal startup alone leaves this path unchecked. Confirm the virtual model in `bb provider models pi`, which also supplies the automation model selector. The BB slash-command workaround, if still needed, is already in the linked guide.

Write the runnable guide alongside the encounter and keep its evidence under this ticket's packet. This is a usable fixture and first-use record, not a new test suite.

## Result

done — no repairs needed; all eight stories hold on head `6aac13aa`. I appended a review section to the driver's `drive-6.md`.

- **Diff:** it is the guide section, a `scripts/life-playground.ts` change that adds the stances extension and moves prompt after context, and the packet. I re-ran `prepare-agent`. The wrapper loads agents, stances, context, then prompt, and project settings register only the disposable `agents` dir. Notes are omitted from `memory.systems` and `notes.enabled` is false.
- **Guide:** its commands match the launcher's behaviour (`--no-life-env`, `--fork`, and `--model` replacing the default provider).
- **Tests:** `bun test extensions/context extensions/system-prompt` gives 42 pass, 0 fail. There is no `test:affected` task.
- **Frictions:** I filed nothing new. The compaction "empty reply" occurrence is already on `life-first-use-compaction-empty-reply-warning`, an idea waiting on capturing the failing call's stopReason. The BB slash-submission hang is owned by get-bb/bb#3792 and the guide documents the workaround.
- **Screenshots:** I attempted the first one, but the tool dump was truncated and I didn't inspect either image. The review rests on the driver's packet.

```yaml
commit: 6aac13aa
stories:
  - {story: "Fresh named-agent startup supplies soul, private skill and note", outcome: held}
  - {story: "Ordinary sibling isolation, explicit attach and shared skill edit", outcome: held}
  - {story: "Model change preserves identity; note opt-out and detach work", outcome: held}
  - {story: "Late agent-model selection does not attach existing history", outcome: held}
  - {story: "Resume/fork inherit attachment; explicit off persists", outcome: held}
  - {story: "Ordinary stance worker has no agent identity", outcome: held}
  - {story: "Busy attached session appears in sibling's Working present", outcome: held}
  - {story: "BB post-start model selection supplies identity and catalog selector", outcome: held}
evidence:
  path: docs/attachments/named-agent-first-use-in-terminal-and-bb/drive-6.md
  visual: true
  shots:
    - docs/attachments/named-agent-first-use-in-terminal-and-bb/drive-6-bb.jpg
    - docs/attachments/named-agent-first-use-in-terminal-and-bb/drive-6-bb-edited.jpg
tests: []
filed: []
caveats:
  - "Driver's disposable /tmp/pi-life-VUTkKn is retained for replay with trust removed. My smoke root was deleted."
  - "Nothing of mine is left running."
```

Evidence: [docs/attachments/named-agent-first-use-in-terminal-and-bb/drive-6.md](../attachments/named-agent-first-use-in-terminal-and-bb/drive-6.md)
