---
stage: "done"
assignee: "agent:auto-routine"
author: "session:01a1cdc8-f756-70d2-9515-c6c42afeff63"
priority: 2
part-of: "[[projects/mlegls-pi/issues/attention-inbox-in-the-bb-tracker]]"
---
Agents can file credential requests in the shared desk without waiting in their turn, and decision requests expose a recommendation the Attention panel can reuse. This is the item-format part of [[projects/mlegls-pi/issues/attention-inbox-in-the-bb-tracker]], for [[projects/mlegls-pi/stories/answer-what-agents-ask-of-me]].

## shape

Implement the parent's “the item format, in this repository” shape in [desk.ts](../../lib/desk.ts), the [attention skill](../../skills/enabled/all/mlegls/conventions/attention/SKILL.md) and the [desk guide](../guide/desk.md): repeatable `--secret NAME=DESCRIPTION`, an absolute `--write-env PATH` required with secrets, and one `Secret: NAME → PATH: DESCRIPTION` line directly below `Owner:` per variable. Preserve ordinary items and the existing replacement/removal behavior. Options expose their pick on its own `Recommended:` line. Explain when a desk secret request is appropriate versus the turn-blocking `bb secret request`.

Try the checkout's helper against the guide's disposable repository, producing ordinary and multi-variable credential items and removing them again. The combined browser first use belongs to the parent after both children land; leave a runnable helper entry point and example invocation in the handoff.

## Result

done

The diff `5ff9479d..HEAD` matches the ticket, and I made no repairs.

- **Secret requests:** repeatable `--secret NAME=DESCRIPTION` and an absolute `--write-env PATH` produce one `Secret: NAME → PATH: DESCRIPTION` line per variable, directly below `Owner:`. Replacement and removal behave as before.
- **Validation:** I ran the error paths myself, and each exits 1 with a clear message:
  - `--write-env` without a secret.
  - A relative path.
  - A duplicate variable name.
  - A name that isn't a valid variable.
  - Secret options used outside `attention add`.
- **Docs:** the attention skill and the desk guide cover the `Recommended:` line. They also explain when to use a desk secret request versus `bb secret request`.
- **Driver's packet:** I read it against the diff and it is consistent. No tests were added or changed.
- **Frictions:** none were filed or linked.
- **Structure:** this isn't a join, so no structural pass.

```yaml
commit: 00f6a47e
stories:
  - story: Ordinary decision requests retain a standalone recommendation
    outcome: held
  - story: Multi-variable credential requests record secret metadata without blocking
    outcome: held
  - story: Replacement and removal preserve other attention items
    outcome: held
  - story: Secret requests require an absolute destination
    outcome: held
evidence:
  path: docs/attachments/desk-attention-items-carry-secret-requests-and-recommendations/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - Combined Attention-panel first use (writing the supplied values and notifying the owning thread) remains the parent's.
```

Evidence: [docs/attachments/desk-attention-items-carry-secret-requests-and-recommendations/index.md](../attachments/desk-attention-items-carry-secret-requests-and-recommendations/index.md)
