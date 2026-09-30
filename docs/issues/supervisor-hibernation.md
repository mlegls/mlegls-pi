---
assignee: agent
part-of: "[[projects/mlegls-pi/issues/loop-vs-supervision-tree]]"
---

The "stateless supervisors" optimization of tree-style supervision can be framed as a compaction strategy: the difference from supervision as it is now is more frequent compaction (and perhaps a different mechanism) when the supervisor expects to go idle for a long time.

Keys: `erlang:hibernate/3` (discard the stack, compact the heap, resume in a named function on the next message), actor passivation (Akka Persistence, Orleans grains: evict when idle, rebuild from snapshot and journal), Letta's sleep-time compute.

Prompt-cache lifetime motivates folding before a long wait: past it, the next wake re-reads the whole context anyway. The implementation now waits for actual inactivity rather than predicting it. The fold can reuse the captured request prefix (`prefixMode: captured`), but that does not establish a warm provider cache at the deadline; measure actual cache usage separately.

The memory extension's journal is already the right shape: a traceable log with subjective aspects, citation-grounded blocks plus recall of originals. The canonical state (job, ledger, issues) goes stale and is re-read on wake with `ab supervise status`, so the fold keeps what those don't record: judgments about children, decisions and why, suspicions, intentions. Decisions that bind children or the human belong in the issue, with the journal citing them. C (stateless handlers) is this with an empty journal.

Implemented in `extensions/memory/hibernate.ts` and `extensions/memory/index.ts`: `agent_settled` arms an inactivity timer for a session that owns a running supervise job with live children. The deadline is 300 seconds for Anthropic/Bedrock and 3600 seconds for other providers, independent of the tool-output elision table. Activity cancels the timer. At the deadline the session must still be idle, have no pending messages, own live children, and have at least `memory.hibernate.minTokens` (default 4000) foldable. `memory.hibernate.enabled` disables it; the former `expectedIdleSeconds` setting is ignored. Journals may cite `[@issue:slug]`, `[@commit:sha]` and `[@job:id]` alongside entries. Hibernation folds record `trigger: hibernate`.

2026-09-27 trial: a GLM 5.3 Flash session posing as the owner of a fake three-child job folded after its turn with the cached prefix, cited `[@job:t]`, and wrote mostly judgment ("treat all child-specific expectations as predictions to check... First wake action: `ab supervise status`"), with some restated code facts. The next settle didn't refold.

Residual work is delegated to three tickets: [[projects/mlegls-pi/issues/supervisor-hibernation-first-use]] prepares and tries a real supervise campaign; [[projects/mlegls-pi/issues/supervisor-hibernation-empty-journal]] supplies the C arm; [[projects/mlegls-pi/issues/supervisor-hibernation-comparison]] then compares A (fold only at the context threshold), H (hibernate with journal), and C (hibernate with an empty journal, rebuilding from artifacts) on that campaign. Measure owner tokens, wakes, and decision contradictions (reversing or re-asking something already settled). H vs C prices the journal; A vs H prices full context. No orchestration default changes are authorized by the comparison.

Open, outside this comparison: whether supervisors on non-Anthropic models do better with the older, more explicitly introspective registers (see [[projects/mlegls-pi/issues/compaction-register-variants]]), and whether a future predicted-idle policy should use children's timeboxes instead of a setting. The earlier expected-idle policy is historical, not an arm of this experiment.
