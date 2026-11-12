---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:01a1cdc8-f756-70d2-9515-c6c42afeff63"
priority: 2
part-of: "[[projects/mlegls-pi/issues/attention-inbox-in-the-bb-tracker]]"
claimed-by: "reconcile:attention-inbox-in-the-bb-tracker/attention-inbox-in-the-bb-tracker-refine-1"
---
Agents can file credential requests in the shared desk without waiting in their turn, and decision requests expose a recommendation the Attention panel can reuse. This is the item-format part of [[projects/mlegls-pi/issues/attention-inbox-in-the-bb-tracker]], for [[projects/mlegls-pi/stories/answer-what-agents-ask-of-me]].

## shape

Implement the parent's “the item format, in this repository” shape in [desk.ts](../../lib/desk.ts), the [attention skill](../../skills/enabled/all/mlegls/conventions/attention/SKILL.md) and the [desk guide](../guide/desk.md): repeatable `--secret NAME=DESCRIPTION`, an absolute `--write-env PATH` required with secrets, and one `Secret: NAME → PATH: DESCRIPTION` line directly below `Owner:` per variable. Preserve ordinary items and the existing replacement/removal behavior. Options expose their pick on its own `Recommended:` line. Explain when a desk secret request is appropriate versus the turn-blocking `bb secret request`.

Try the checkout's helper against the guide's disposable repository, producing ordinary and multi-variable credential items and removing them again. The combined browser first use belongs to the parent after both children land; leave a runnable helper entry point and example invocation in the handoff.
