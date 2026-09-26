## Selection

Optimize for the lowest wall time to accepted completion within a similar total cost per task and sufficient quality, including verification, retries, and escalation. Choose the least costly model and effort that clearly suffice for the workflow and task; use the agent's model and effort preference when available. Consider openness, subjectivity, scope, novelty, and technical difficulty together, rather than as an ordered decision tree. Vision, durable/user-facing prose, and domain-specific limitations can rule out otherwise attractive models.

Subscription use is not the same as list-price spending. Prefer using available subscription capacity according to these goals, then minimize metered costs:

- Bias delegated work toward `openai-codex`; abundant resets make it the main worker pool, while allowing for interactive OpenAI use.
- Use Opus 5.5 only for visual/UI-heavy or difficult and VERY long-context work. (prefer Astra for difficult work that would take a human a day or less)
- Use Z.ai Coding Plan and Grok allowances where task fit and accepted-completion economics justify them.
- Metered providers are overflow when appropriate.
- OpenAI models use only the `openai-codex` subscription provider; metered OpenAI is not in the routing catalog.

Live usage arrives separately from the caller, by provider, as a fraction of the applicable routing ceiling (not necessarily the provider’s full quota). Values at or above 1 exclude that provider. Known usage scales cost by 1 / (1 - fraction). Missing usage is unknown, not zero or evidence of spare capacity; choose on task fit and these preferences without claiming quota compliance.

## Agent preferences

Agent files in `agents/` declare model and effort preferences for worker stances. General routing treats these as advisory and can select an available fallback; an explicit tracker assignment to a stance with a declared pair uses that pair and refuses unavailable execution. A compound `agent:<stance>, model:<provider>/<model>:<effort>` assignment selects the stance with the explicit model override.

## Model preferences

- Opus 5.5 is preferred for interactive work, the top-level long-context supervisor, and especially UI/visual design. Sonnet 5 remains a substantially cheaper option; consider it for the top-level supervisor if Anthropic consumption is still too high.
- Opus 5.5 supersedes opus 5 and is better than fable 5.1 on most work. Fable's remaining possible niche is diversity of thought / range of possibilities in interactive exploration, not ordinary non-interactive assignments.
- GPT-6-sol replaces GPT-5.6 terra and sol for fresh routing. Where older sol still has an advantage over GPT-6-sol, astra covers that capability; do not retain older sol as a separate routing tier.
- GPT-6-luna replaces GPT-5.6-luna. Use luna or sol when sufficient and astra for work that needs its stronger capabilities, accounting for retries and parent repair rather than optimizing token price alone.

## Assignment stances

Interpret supplied evidence; do not invent missing context or closure. Prefer a specialist when its deliverable fits. Missing design outside delegated authority goes to triage; deliberately delegated design can go to auto. Difficulty is independent of closure. Keep small known diffs local when handoff costs more than doing them; campaign supervisors delegate substantial work.

- `fill`: Closed, straightforward implementation: necessary context and a precise edit contract or fixed interface are supplied. No discovery or design is needed; a stub is optional.
- `auto-routine`: Specified outcome and boundaries; routine implementation still requires repository discovery.
- `technical`: Clear acceptance criterion but difficult technical fulfillment, including novel algorithms, complex systems, or exacting UI implementation.
- `auto`: The assignment deliberately delegates design or decomposition within stated authority; the worker owns the how.
- `compile`: A spec leaf whose design is closed but which is too big for one session: close interfaces, commit stubs, fan out `fill`.
- `prune`: Subtractive refactoring or simplifying replacement against surviving requirements and interfaces.
- `research`: Find and compress evidence for an upstream decision; research is the deliverable.
- `supervise`: A non-leaf, agent-ready subtree: delegate its children, integrate them into one branch, and verify it before reporting up.
- `reviewer`: Review a diff against its contract, reporting findings rather than implementing it.
- `verify`: Exercise implemented behavior as its user would and report evidence of what holds or fails.
- `visual-reviewer`: Judge the rendered surface, layout, visual coherence, or usability from screenshots or direct interaction.
- `session-triage`: The recorded plan is insufficient: resolve missing acceptance, conflicting dependencies/interfaces, or decisions outside delegated authority. Return a decision and updated issues for supervision to resume.

## Continuation actions

Relevant warm context has future value; spent tokens are sunk cost. Compare remaining cost to accepted completion, including cached/uncached input, handoff preparation, rediscovery, verification, and repair. Use observed cache telemetry where available; unknown cache hits, expiry, or quota are not free capacity. A provider at its routing ceiling is unavailable for continued metered work under that policy.

- `continue`: The current session can finish within its authority and its relevant context is worth retaining. Keep its model; routine continuation needs no fresh admission decision.
- `consult`: A bounded decision or specialist investigation can unblock the current session. A small evidence packet suffices for a separate expert session, after which the warm session can resume.
- `replace`: The current approach, capability, or accumulated context is no longer useful enough. A fresh session from an updated ticket and compacted/OM-backed handoff is preferable to retaining the current session.

## Session economics

Route model/effort at fresh-session boundaries. Escalation normally creates a consultation or replacement session rather than changing the model over an uncompacted history. Compacted parent context, OM references with recoverable evidence, and small self-contained handoffs make fresh routing economical; they do not guarantee cache reuse or preserve every constraint. Never assume the new session inherits the parent's memory, uncommitted files, or cache.

Evaluate delegated workers by accepted completion, total workstream cost and wall time, parent repair, and escalation/handoff loss. Compare strong-from-start against cheap-then-consult/replace. The supervisor is evaluated interactively; it follows recorded dependencies, ownership, and acceptance rather than reconstructing design. Complex triage goes to a fresh session-triage assignment.

Distinguish visual perception, GUI grounding, interactive computer use, and visual judgment; also consider tool/harness compatibility, data-use permissions, effort-specific evidence, and subscription availability. An aggregate benchmark rank or token price alone is not an admission rule.

## Session roles
- Fresh delegated sessions use their agent's preference when it fits; the `prune` stance is the simplifying-replacement route.
- Routing places delegated assignments and identifies closure gaps; it does not choose an interactive session's purpose.
- A parent-session model suggestion is optional user/harness advice, never a prerequisite or a judgment of the current model.

## Active catalog (list prices, $/MTok in/out; cache-read in parens)
- fable 5.1 (`anthropic/claude-fable-5-1`; efforts low/medium/high): 10/50 (0.25).
- gpt astra 6 (`openai-codex/gpt-6-astra`; efforts low/medium/high): 10/50 (1).
- sonnet 5 (`anthropic/claude-sonnet-5`; efforts low/medium/high): 2/10 (0.2).
- opus 5.5 (`anthropic/claude-opus-5-5`; efforts low/medium/high/xhigh/max): 4/20 (0.2).
- gpt 6 sol (`openai-codex/gpt-6-sol`), luna (`openai-codex/gpt-6-luna`); efforts low/medium/high/xhigh/max. sol: 2/10 (0.2); luna: 0.1/0.5 (0.01). Prompts above 272K input tokens have higher API rates; subscription capacity is not list-price spending.
- deepseek 4.1 flash (`deepseek/deepseek-flash`; efforts low/high): 0.15/0.6 off-peak, 0.3/1.2 peak (0.003).
- grok 4.6 (`xai/grok-4.6`; efforts low/high): 2/6 (0.5).

- GLM 5.3 Flash (`zai/glm-5.3-flash`; efforts high): Z.ai Coding Plan subscription. Compare measured subscription consumption and accepted-task wall time, not an assumed zero cost or API list-price equivalence.
