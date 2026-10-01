---
priority: 4
stage: done
assignee: agent
author: session:01a0e217-e2af-7760-9a10-b4be54db2d0a
---

Obsolete 2026-10-01: the dsh port was deleted in the pi 0.99 rebuild (`4b79baa`).

Owner: deepseek-harness host tool/session APIs. During
[[projects/mlegls-pi/issues/archive/dsh-memory-compaction-provider]], a temporary plugin
called `ctx.tools.execute(run_code)` on an idle agent. The call succeeded and
returned the full original event, but reload rejected its PTC dispatch events as
outside a turn. Adding turn markers by hand was not a complete fix: the live
agent's next turn counter did not advance, so a later model turn reused a number
and reload rejected it. The live append path admitted both diagnostic histories.

Workaround: drive tools through `agent.followup` and let the loop own lifecycle.
The final fork encounter used model-driven PTC and both sessions reloaded.
The memory provider itself only compacts inside the inherited agent pre-step and
request-error hooks. Upstream's issue tracker is disabled (see
[[projects/mlegls-pi/issues/archive/dsh-session-append-ignorable]]).

Clarify the lifecycle precondition on direct host tool execution, or fail before
writing dispatch events when no turn is open. Do not repair this by weakening
persistence validation.

decision, 2026-09-30: deferred while DSH isn't the daily harness (its upstream tracker is disabled).
