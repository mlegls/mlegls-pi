---
stage: "done"
assignee: "agent:technical"
author: "session:01a1cd90-31ee-71eb-b6b4-d3031eb4ea79"
priority: 2
part-of: "[[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]"
---
goal: Every session of a life builds and reads one shared summary tree, with the place of each message carried into its lines. Simultaneous compactors reuse one another's work instead of each paying to build the same node. This owns nodes and compactor in [[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]; run views and their saved `life.view` are the session ticket.

## shape

Adapt the moved [build.ts](../../extensions/context/life/build.ts) to consume the durable `LifeLog` and messages from [contracts.ts](../../extensions/context/life/contracts.ts), rather than the current session branch. The prerequisite supplies `lifeLog(id)` and the copied log. Node keys are life, fanout, level and index; records use `life.node`, keep the writing model, and the first committed record for a key wins. Preserve the scored-cut loss/overlay behavior against permanent life keys, and keep [tree.ts](../../extensions/context/life/tree.ts), [cache.ts](../../extensions/context/life/cache.ts) and [score.ts](../../extensions/context/life/score.ts) unchanged.

A node's source is `kind@place: text`. Before a model call, append a `life.lease` for the key and build only when this is the earliest lease younger than ten minutes. Pick up other processes' nodes by polling [store.ts](../../lib/records/store.ts)'s `version()`, including while `idle()` waits for the first request. Retry when an abandoned lease expires, honor cancellation, and avoid replacing the winning node with a later local result.

Settings move to `memory.schemas.life` with the parent's fields; unset model resolves to the turn's model rather than OM's. Preserve the turn system prompt/tools and cache marking on that model. The runtime still has a moved, branch-facing caller until the next ticket lands: leave it loadable, then let that ticket remove transitional glue. Update the existing [build.test.ts](../../extensions/context/life/build.test.ts) to the durable-log setup and place-bearing source format.

First use is two separate compactors on one temporary store, including one waiting for a node another writes. Show a single lease winner, first-record-wins loading, and expired-lease recovery; a controlled worker-stream boundary can make these interleavings observable without model spend. The runtime ticket carries first use through real attached sessions.

Questions of intent go to `session:hermes-concept-strategy`, the owner named in the parent.

## Result

done

All six stories hold on my final head. I re-ran `first-use.ts` after my repairs, and `bun test extensions/context` (35 pass) and `bun run typecheck` both pass.

I found and fixed two performance defects in the diff:

- **Full-log reload on every store write.** `Chat.refresh()` re-read the entire life log whenever any record was written to the shared store. On 5,000 messages of 2 kB that cost 57–64 ms per read, at up to 4 Hz per chat. `LifeLog.read(from?)` now takes an optional start position, and the chat reads only `read(T)`, where `T` is the count of messages it already holds. With nothing new the read takes 1.2 ms. A quick append-after-sync check also resolved all five positions in order.
- **Branch adapter `before()`.** In `extensions/context/life/index.ts` it re-ran `messagesOf` over the whole branch for every candidate boundary in the context loop. It now does one bisection over entry positions computed once per sync.

The review is appended to `docs/attachments/life-compacts-one-shared-tree/drive.md`.

```yaml
commit: 8dd1be2f  # repairs 04956887, review log 8dd1be2f
stories:
  - story: Separate compactors elect one lease winner and adopt its node while idle
    outcome: held
  - story: Fresh loading preserves the first committed record
    outcome: held
  - story: An abandoned lease expires and work resumes
    outcome: held
  - story: Late local output preserves the sibling's committed winner
    outcome: held
  - story: Cancellation releases idle and prevents late writes
    outcome: held
  - story: Controlled calls preserve turn environment and place-bearing input
    outcome: held
evidence:
  path: docs/attachments/life-compacts-one-shared-tree/index.md
  visual: false
  shots: []
tests:
  - extensions/context/life/build.test.ts
fixed:
  - "04956887: LifeLog.read(from?) with incremental reload in Chat.refresh; bisection in the branch adapter's before()"
caveats:
  - "Controlled model boundary only; no paid model or attached-session encounter. The runtime ticket carries real first use."
  - "Scored-cut across processes and settings persistence were not exercised by any drive. Loss scoring has no lease, so two attached compactors may both pay for a scorer call; only the first record is kept."
  - "Cost of the change: each Chat polls version() every 250 ms. Now that reads are incremental, an unchanged store costs about 1 ms per tick."
  - "A failed build keeps its lease for the full ten minutes, so other processes wait that long. Our own process retries immediately."
  - "contracts.ts changed: read(from?) is optional and backward compatible."
```

I added no tests and changed no assertions. The driver filed no frictions, so there was nothing to triage.

Evidence: [docs/attachments/life-compacts-one-shared-tree/index.md](../attachments/life-compacts-one-shared-tree/index.md)
