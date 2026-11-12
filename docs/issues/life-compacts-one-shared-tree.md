---
stage: "ticket"
assignee: "agent:technical"
author: "session:01a1cd90-31ee-71eb-b6b4-d3031eb4ea79"
priority: 2
part-of: "[[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]"
claimed-by: "reconcile:one-life-for-a-named-agent-across-simultaneous-sessions"
blocked-by:
  - "[[projects/mlegls-pi/issues/life-log-copies-and-orders-runs]]"
---
goal: Every session of a life builds and reads one shared summary tree, with the place of each message carried into its lines. Simultaneous compactors reuse one another's work instead of each paying to build the same node. This owns nodes and compactor in [[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]; run views and their saved `life.view` are the session ticket.

## shape

Adapt the moved [build.ts](../../extensions/context/life/build.ts) to consume the durable `LifeLog` and messages from [contracts.ts](../../extensions/context/life/contracts.ts), rather than the current session branch. The prerequisite supplies `lifeLog(id)` and the copied log. Node keys are life, fanout, level and index; records use `life.node`, keep the writing model, and the first committed record for a key wins. Preserve the scored-cut loss/overlay behavior against permanent life keys, and keep [tree.ts](../../extensions/context/life/tree.ts), [cache.ts](../../extensions/context/life/cache.ts) and [score.ts](../../extensions/context/life/score.ts) unchanged.

A node's source is `kind@place: text`. Before a model call, append a `life.lease` for the key and build only when this is the earliest lease younger than ten minutes. Pick up other processes' nodes by polling [store.ts](../../lib/records/store.ts)'s `version()`, including while `idle()` waits for the first request. Retry when an abandoned lease expires, honor cancellation, and avoid replacing the winning node with a later local result.

Settings move to `memory.schemas.life` with the parent's fields; unset model resolves to the turn's model rather than OM's. Preserve the turn system prompt/tools and cache marking on that model. The runtime still has a moved, branch-facing caller until the next ticket lands: leave it loadable, then let that ticket remove transitional glue. Update the existing [build.test.ts](../../extensions/context/life/build.test.ts) to the durable-log setup and place-bearing source format.

First use is two separate compactors on one temporary store, including one waiting for a node another writes. Show a single lease winner, first-record-wins loading, and expired-lease recovery; a controlled worker-stream boundary can make these interleavings observable without model spend. The runtime ticket carries first use through real attached sessions.

Questions of intent go to `session:hermes-concept-strategy`, the owner named in the parent.
