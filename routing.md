# Routing policy

The single policy source for `lib/route.ts`, read at call time. Edit this file to change routing; no Obsidian notes are loaded. Prices and model opinions below are personal guidance, not capability guarantees.

## Selection

Choose the least costly model and effort that clearly suffice for the workflow and task. Consider openness, subjectivity, scope, novelty, and technical difficulty together, rather than as an ordered decision tree. Vision, durable/user-facing prose, and domain-specific limitations can rule out otherwise attractive models. Follow the model characteristics and effort guidance below.

Subscription use is not the same as list-price spending. Prefer using available subscription capacity according to these goals, then minimize metered costs:

- Aim for close to, but no more than, 50% of the Anthropic weekly quota on non-fable workers; preserve interactive fable capacity.
- Aim to use the OpenAI and Grok weekly allowances, while allowing for interactive OpenAI use, especially astra.
- Metered providers are overflow when appropriate.

Live usage arrives separately from the caller, by provider, as a fraction of the applicable routing ceiling (not necessarily the provider’s full quota). For example, 40% weekly usage against a 50% ceiling is 0.8. Values at or above 1 exclude that provider. Known usage scales cost by 1 / (1 - fraction). Missing usage is unknown, not zero or evidence of spare capacity; choose on task fit and these preferences without claiming quota compliance. This first version does not fetch usage or reserve capacity.

## Model characteristics

- fable 5.1 (`anthropic/claude-fable-5-1`; efforts low/medium/high): great at coherency across long context and organizing big ideas. e.g. forming macro plans/campaigns, triaging messy issue ports, interactive discussion, and top-level campaign supervision. less likely to go along with bullshit than astra, but more vulnerable to making too much of existing records or otherwise inappropriately evaluating "significance" (e.g., strong tendency to say "x is already y" as if it's not an obviously established prior)
- gpt astra 6 (`openai-codex/gpt-6-astra`, overflow `openai/gpt-6-astra`; efforts low/medium/high): more "raw intelligence" than fable in the programming competition/puzzle solving sense. can solve pretty much any specific problem in one turn. great at numerical or evidence-based analysis. however, will go along with anything, and sometimes loses track of the goal if it goes for too long. highly malleable in the slay the princess sense.
- sonnet/opus/fable 5: sonnet and opus are very clearly distilled from fable 5, so their behaviors often seem like a "superficial" imitation of it. this makes them inappropriate for writing any user-facing prose (especially ui text/copy), bc they have an extremely distinct voice that's almost impossible to steer away from, which gives the sense of trying to imitate the *mannerisms* of someone much smarter without really being able to mirror their style of thought. can solve problems in the sense of meeting the specified requirements, but opus and sonnet 5 especially are not "tasteful" in terms of code elegance/simplicity, and even fable 5 was difficult to steer toward writing diffs that remove more than they add. opus and sonnet also have an extremely deeply engrained habit of recording things reactively, and writing comments/docs/issues etc as a record of what they did in their session and how that differed from how they found things, as opposed to standing alone about current state.
- gpt 5.6 luna/terra/sol: there's little reason to use sol bc astra is usually actually cheaper bc it's much better at being token efficient. luna/terra are good at api-style tasks, including well-specced implementation. straightforward with few behavioral quirks
- deepseek 4.1 flash (`deepseek/deepseek-flash`; efforts low/high): more base model like than any american model, as in, capable of being steered into different "moods" by the prompt. its default persona is not strongly engrained, so it's very flexible. similar intelligence to fable 5 but much cheaper. but also thinks for much longer.
- grok 4.6 (`xai/grok-4.6`; efforts low/high): lower raw intelligence than fable 5/sol 5.6, but very "straightforward". similar in this to astra 6. will take the direct approach to a problem, and better at code deletion than anthropic or openai models except fable 5.1/astra. i think the alignment training approaches used by openai and anthropic probably led to some neuroses about privacy/safety/security/testing etc via connotative transfer; one of grok's greatest strengths is not being so attracted to "gates"/"guards"/"checks" etc, or generally defensiveness/"enterprise"ness

## catalog (2026-09-20 list prices, $/MTok in/out; cache-read in parens)
notation: each bullet names its pi model id(s) in backticks as `provider/model` and its effort set; the router's candidates are exactly those pairs. ids from `pi --list-models`.
- fable 5.1 (`anthropic/claude-fable-5-1`; efforts low/medium/high): 10/50 (0.25). effort: low for top level orchestration of something already specified, or rewriting/simplifying existing functionality. medium for knotty open questions
- gpt astra 6 (`openai-codex/gpt-6-astra`, overflow `openai/gpt-6-astra`; efforts low/medium/high): 10/50 (1). effort: almost never above low, except frontier math or similarly technical problems.
- opus 5 (`anthropic/claude-opus-5`), sonnet 5 (`anthropic/claude-sonnet-5`); efforts low/medium/high. opus: 5/25 (0.5). sonnet 5: 2/10 (0.2). effort: fairly linear with task difficulty
- gpt 5.6 sol (`openai-codex/gpt-5.6-sol`), terra (`openai-codex/gpt-5.6-terra`), luna (`openai-codex/gpt-5.6-luna`); overflow under `openai/`; efforts low/medium/high. sol: 4/20 (0.4) — rarely worth it over astra. terra: 2/12 (0.2). luna: 0.2/1.2 (0.02). effort: fairly linear with task difficulty
- deepseek 4.1 flash (`deepseek/deepseek-flash`; efforts low/high): 0.15/0.6 off-peak, 0.3/1.2 peak (0.003). effort: fairly linear with task difficulty; thinks very long with high though
- grok 4.6 (`xai/grok-4.6`; efforts low/high): 2/6 (0.5). effort: fairly linear with task difficulty

## Calling

`await route.route(workflow, task, { policyPath, usage })` in exec; both options are optional. `usage` is a provider-keyed map of normalized fractions or null. The default policy path is this package’s root `routing.md`, independent of the current directory.

Returns `model`, `effort`, winning probability `p`, and `dist` keyed by `provider/model@effort`, plus `policyPath` and the supplied usage snapshot. Probabilities compare alternatives, not overall correctness; no uncalibrated confidence gate is imposed.

CLI: `bun lib/route.ts <workflow> <task text> [policy-path]`.
