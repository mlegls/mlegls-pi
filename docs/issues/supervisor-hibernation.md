---
stage: ticket
assignee: agent
part-of: "[[projects/mlegls-pi/issues/loop-vs-supervision-tree]]"
---

The "stateless supervisors" optimization of tree-style supervision can be framed as a compaction strategy: the difference from supervision as it is now is more frequent compaction (and perhaps a different mechanism) when the supervisor expects to go idle for a long time.

Keys: `erlang:hibernate/3` (discard the stack, compact the heap, resume in a named function on the next message), actor passivation (Akka Persistence, Orleans grains: evict when idle, rebuild from snapshot and journal), Letta's sleep-time compute.

Prompt-cache lifetime sets the threshold. Past it, the next wake re-reads the whole context anyway, so folding before the wait costs nearly nothing extra and makes every later wake cheaper. Folding at the end of the supervisor's turn, while the cache is warm, sends the fold on the cached prefix (`prefixMode: captured`); folding at the next wake would pay for a cold prefill of the old context first.

The memory extension's journal is already the right shape: a traceable log with subjective aspects, citation-grounded blocks plus recall of originals. The canonical state (job, ledger, issues) goes stale and is re-read on wake with `ab supervise status`, so the fold keeps what those don't record: judgments about children, decisions and why, suspicions, intentions. Decisions that bind children or the human belong in the issue, with the journal citing them. C (stateless handlers) is this with an empty journal.

Implemented in `extensions/memory/hibernate.ts`: on `agent_settled`, a session that owns a running supervise job with live children folds with a hibernation focus if `memory.hibernate.expectedIdleSeconds` (default 1800) is at least the provider's cache lifetime (the `elide` table) and at least `memory.hibernate.minTokens` (default 4000) are foldable. Providers with unknown cache lifetimes (a day by default, e.g. Z.ai) don't qualify unless `expectedIdleSeconds` is raised. Journals may cite `[@issue:slug]`, `[@commit:sha]` and `[@job:id]` alongside entries. Hibernation folds record `trigger: hibernate`.

2026-09-27 trial: a GLM 5.3 Flash session posing as the owner of a fake three-child job folded after its turn with the cached prefix, cited `[@job:t]`, and wrote mostly judgment ("treat all child-specific expectations as predictions to check... First wake action: `ab supervise status`"), with some restated code facts. The next settle didn't refold.

first use: a real supervise run. Then compare three arms on one campaign: A (fold only at the context threshold), H (hibernate with journal), C (hibernate with an empty journal, rebuilding from artifacts). Measure owner tokens, wakes, and decision contradictions (reversing or re-asking something already settled). H vs C prices the journal; A vs H prices full context.

Open: whether supervisors on non-Anthropic models do better with the older, more explicitly introspective registers (see [[projects/mlegls-pi/issues/compaction-register-variants]]); expected idle could come from children's timeboxes instead of a setting.
