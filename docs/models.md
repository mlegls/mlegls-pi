# Models

Reasoning behind the `model:` lists in `agents/`. The router doesn't read this; read it when writing or revising a model list. How much of each provider delegated work may use is `allocation.json`. Valid `provider/model:effort` pairs are the Active catalog in `routing.md` (IDs from `pi --list-models`).

## Capacity

Subscription use is not the same as list-price spending. Prefer using available subscription capacity according to these goals, then minimize metered costs:

- Bias delegated work toward `openai-codex`; abundant resets make it the main worker pool, while allowing for interactive OpenAI use.
- Split by lab strength. Anthropic models hold a clear advantage on long-context work and on carrying a goal through to completion; OpenAI models excel on well-scoped tasks but more often stop abruptly or drift. Route judgment over a whole picture to Anthropic (triage, review, consolidation at a join) and bounded execution to `openai-codex` (implement, drive). Supervision compacts once its cache goes stale, so it is closer to a sequence of bounded decisions and goes to `openai-codex`.
- Use Z.ai Coding Plan and Grok allowances where task fit and accepted-completion economics justify them.
- Metered providers are overflow when appropriate.
- OpenAI models use only the `openai-codex` subscription provider; metered OpenAI is not in the routing catalog.

## Models

- Use Opus 5.5 for interactive work, the top-level long-context supervisor, difficult and very long-context delegated work, and visual review—not UI implementation merely because it touches a rendered surface. Delegated design-taste work (`ui`), review and consolidation are on trial with Sonnet 5.5 high; for UI, the Opus visual reviewer holds taste at acceptance and may improve on it.
- Sonnet 5.5 spends many output tokens per task (about 193K per Intelligence Index task at max, the most Artificial Analysis has measured). It sits off the cost-per-task Pareto frontier: at xhigh/max Opus 5.5 delivers the same for less, and at low/medium GPT-6.1-sol does. High is its most competitive setting. It is not monotonic in effort: max scores below xhigh on FrontierCode (it fans out to subagents and makes out-of-scope edits). It matches Opus 5.5 on agentic terminal and knowledge-work benchmarks but trails on factual knowledge and scientific reasoning, with a lower hallucination rate. Avoid Sonnet 5.5 max.
- Opus 5.5 is better than Fable 5.1 on most work. Fable's possible niche is diversity of thought / range of possibilities in interactive exploration, not ordinary non-interactive assignments.
- GPT-6.1-sol sits about one Intelligence Index point below astra at under a quarter of astra's cost per task, and every effort level is on the cost-efficiency frontier. It is the default for difficult non-visual work. Use astra only for the hardest research-grade work where its remaining lead is worth the price.
- Use luna or sol when sufficient, accounting for retries and parent repair rather than optimizing token price alone.

## Evaluating

Distinguish visual perception, GUI grounding, interactive computer use, and visual judgment; also consider tool/harness compatibility, data-use permissions, effort-specific evidence, and subscription availability. An aggregate benchmark rank or token price alone is not an admission rule.

Evaluate a model list by accepted completion, total workstream cost and wall time, parent repair, and escalation/handoff loss, not token price alone. Compare strong-from-start against cheap-then-consult/replace.
