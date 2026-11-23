# Models

Rationale for the `model:` lists in `agents/`. The router doesn't read this; consult it when tuning a stance. Delegated capacity limits live in `allocation.json`, and valid `provider/model:effort` IDs live in [routing.md](../routing.md) (from `pi --list-models`).

## Capacity

Prefer available subscription capacity before metered spend:

- Bias delegated execution toward `openai` (signed in via ChatGPT `/login`, which uses the subscription; metered API-key `openai` is outside the catalog, and `openai-codex` is retired). Abundant resets make it the main worker pool while preserving interactive headroom.
- Split by lab strength: Anthropic holds an edge on long-context coherence and seeing a goal through; OpenAI excels on bounded tasks but stops early or drifts more often on open-ended spans. Route whole-picture judgment (triage, review, join consolidation) to Anthropic and bounded execution (implement, drive) to `openai`. Compaction turns supervision into a sequence of bounded decisions, so it also fits `openai`.
- Use Z.ai Coding Plan and Grok allowances where task fit and accepted-completion economics warrant them; treat metered providers as overflow.

## Models

- **Opus 5.5**: interactive work, top-level long-context supervision, hard/long-context delegated tasks, and visual review. Current routing (maintainer, 2026-11-23): `auto` Sol high, `auto-routine`/`prune` Sol medium, `verify` Sol low, `technical`/`tidy` Astra medium, `ui` Sol high, `reviewer`/`visual-reviewer` Opus 5.5 medium (reviewer stronger than implementer and cross-lab; visual reviewer holds taste and may improve aesthetics), `manager` Gemini 4 Neon high via Antigravity falling back to Opus.
- **Sonnet 5.5**: verbose (~193K output tokens per Intelligence Index task at max) and off the cost-per-task Pareto frontier—Opus 5.5 beats it at xhigh/max, GPT-6.2-sol beats it at low/medium. `high` is its only competitive setting; avoid `max` (non-monotonic on FrontierCode: fans out and makes out-of-scope edits). Matches Opus 5.5 on agentic terminal/knowledge work with lower hallucination, trails on factual knowledge and scientific reasoning.
- **Fable 5.1**: Opus 5.5 beats it on most work; Fable's niche is divergent interactive exploration.
- **GPT-6.2-sol / Astra / Luna**: Sol sits ~1 Intelligence Index point below Astra at under a quarter of the cost per task, with every effort on the efficiency frontier—the default for hard non-visual work. Reserve Astra for where its margin pays off (`technical`, `tidy`). Use Luna or Sol when sufficient, judging by retries and repair cost rather than token price.

## Evaluating

Separate visual perception, GUI grounding, interactive computer use and visual judgment, and factor in harness compatibility, data-use terms, effort-specific behavior and subscription capacity. Judge a model list by accepted completion, total wall time and cost, parent repair, and handoff loss—comparing strong-from-start against cheap-then-consult/replace.
