---
next: research
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

three subscription pools (codex, anthropic, maybe grok) plus metered. constraint: anthropic worker share ≤50% so fable's interactive quota is never crowded; drain codex (and grok) to their weekly ceilings with worker traffic; metered deepseek and jev as overflow. the router takes pool slack as input: a role×model preference table filtered by slack at spawn, not a static roster.

research first: how pi or the providers expose rate-limit state (response headers, usage endpoints), and whether pi already tracks it.

then the table, from the current read of the models: fable 5.1 coordinator; astra hard problems as a control loop with hard metrics in its feedback (it is malleable to the user only, so close the loop with numbers); deepseek/grok hard implementer; luna easy implementer; grok for deletion, prune, simplify, and tests; deepseek for stance-prompted roles (research, review with a lens); sonnet/opus only for reasoning-heavy LLM-facing work and only while the anthropic pool has slack. rows for refactor, computer use, visual taste, test writing stay open until "[[projects/mlegls-pi/issues/orchestration-audits]]" fills them.
