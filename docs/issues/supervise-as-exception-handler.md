---
stage: done
assignee: agent
author: session:01a0cd1a-8da4-701c-8253-d1ab9fd2b4e6
part-of: "[[projects/mlegls-pi/issues/scripted-supervision-loop]]"
---

Rewrite the `supervise` skill and `agents/supervise.md` for an owner that starts the loop and handles what it's woken with: steer if simple, answer from recorded decisions, consult a frontier oracle (one-shot astra/fable low with question and evidence), else escalate with a recommendation. Solved exceptions go to the child and nobody else. No reading children's code, no review, no progress messages.

The interactive root is the same plus a ledger of open human questions, and status generated from the loop's state when asked instead of narrated as events happen.

Follow-up owned by the [[projects/mlegls-pi/issues/scripted-supervision-loop]] supervisor at join: run a real campaign root on GLM 5.3 Flash using the next newly shaped campaign; compare owner wakes, coordination cost and human-facing messages with [[projects/mlegls-pi/research/orchestration-audit-2026-09-23]]. No unclaimed campaign exists, so this comparison is unobservable here, not a completion gate for the rewrite.

Implementation: the skill, stance, pipeline role and CLI help describe an exception-only owner. The loop retains responsibility for drive/review and joins. Supervisor model defaults remain unchanged until the GLM trial supplies evidence. [Preparation and existing regression results](../attachments/supervise-as-exception-handler/index.md).

decisions:
- 2026-09-30: parent supervisor `session:01a0f065-abaf-776c-bc8b-419cb9b312e4` ruled that the skill/stance/role/help rewrite and its regressions are this ticket's delivery. The parent will file the real GLM campaign comparison as its own ticket at join, using the next newly shaped campaign. Do not take over active campaigns; leave the tracker-check failures with their existing owners.

result:
- [First-user drive packet](../attachments/supervise-as-exception-handler/drive/index.md): the local skill entry, stance, role and CLI help exposed the exception-only owner and interactive-root ledger/status procedure. Live GLM comparison remains the separately owned follow-up, not measured by this instruction-surface drive.

## Verification evidence

[Encounter and evidence](../attachments/supervise-as-exception-handler/drive/index.md).
