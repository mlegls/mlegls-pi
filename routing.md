## Agent model lists

Each agent file's `model:` is a list of `provider/model:effort`, most preferred first (e.g. `openai-codex/gpt-6.1-sol:high, anthropic/claude-sonnet-5-5:high`). Routing takes the first entry whose provider has delegated capacity left (`allocation.json`, `lib/allocation.ts`); it doesn't choose models from this file. An `agent:<stance>` assignment keeps the stance's list, fallbacks included; `model:<provider>/<model>:<effort>` is exact and refuses unavailable execution. The reasoning behind the lists is in `docs/models.md`.

## Assignment stances

Choose the stance whose deliverable fits, for the lowest wall time to accepted completion at similar total cost and sufficient quality, including verification, retries and escalation. Consider openness, subjectivity, scope, novelty and technical difficulty together, not as an ordered decision tree. Interpret supplied evidence; do not invent missing context or closure. Prefer a specialist when its deliverable fits. Missing design outside delegated authority goes back to shaping; deliberately delegated design can go to auto. Difficulty is independent of closure. Keep small known diffs local when handoff costs more than doing them; campaign supervisors delegate substantial work.

- `fill`: Closed, straightforward implementation: necessary context and a precise edit contract or fixed interface are supplied. No discovery or design is needed; a stub is optional.
- `auto-routine`: Specified outcome and boundaries; routine implementation still requires repository discovery.
- `technical`: Clear acceptance criterion but difficult technical fulfillment, including novel algorithms, complex systems, or exacting UI implementation.
- `ui`: Work where design taste must actually be exercised: choosing interaction, hierarchy, affordances, state legibility, or visual design. Not implementation from an existing design or simple UI adjustments with settled intent; use `fill`, `auto-routine`, or `auto` with luna or sol when sufficient, and `technical` for hard technical fulfillment. Keep rendered acceptance with `visual-reviewer` on Opus.
- `auto`: The assignment deliberately delegates design or decomposition within stated authority; the worker owns the how.
- `compile`: Refines a spec whose design is closed but which is too big for one session: close interfaces as committed stubs, partition the rest into `fill` tickets.
- `manager`: Refines a spec that delegates design: partition it into outcomes with boundaries, children `auto`/`auto-routine` or further specs.
- `prune`: Subtractive refactoring or simplifying replacement against surviving requirements and interfaces.
- `tidy`: Review at a join: repair crossing stories at their seams, then behavior-preserving tidying across the changes that landed together.
- `research`: Find and compress evidence for an upstream decision; research is the deliverable.
- `reviewer`: Review a change against its contract (and the driver's log when there is one) and repair it directly; non-visual work.
- `verify`: Drive changed behavior as its user would, without reading the implementation; write predictions before first use; record outcomes, frictions, expectations and replayable checks (the reviewer encodes them as tests).
- `visual-reviewer`: Review and repair work whose acceptance is what a user sees: rendered surface, layout, visual coherence, usability. It also makes aesthetic improvements to the surface the change renders, not only corrections. Choose it when the driver's packet is visual.

## Continuation actions

Relevant warm context has future value; spent tokens are sunk cost. Compare remaining cost to accepted completion, including cached/uncached input, handoff preparation, rediscovery, verification, and repair. Use observed cache telemetry where available; unknown cache hits, expiry, or quota are not free capacity. A provider past its delegated share (`allocation.json`) is unavailable for continued delegated work.

- `continue`: The current session can finish within its authority and its relevant context is worth retaining. Keep its model; routine continuation needs no fresh admission decision.
- `consult`: A bounded decision or specialist investigation can unblock the current session. A small evidence packet suffices for a separate expert session, after which the warm session can resume.
- `replace`: The current approach, capability, or accumulated context is no longer useful enough. A fresh session from an updated ticket and compacted/OM-backed handoff is preferable to retaining the current session.

## Session economics

Route model/effort at fresh-session boundaries. Escalation normally creates a consultation or replacement session rather than changing the model over an uncompacted history. Compacted parent context, OM references with recoverable evidence, and small self-contained handoffs make fresh routing economical; they do not guarantee cache reuse or preserve every constraint. Never assume the new session inherits the parent's memory, uncommitted files, or cache.

The supervisor is evaluated interactively; it follows recorded dependencies, ownership, and acceptance rather than reconstructing design.

## Session roles
- Fresh delegated sessions use their agent's model list; the `prune` stance is the simplifying-replacement route.
- Routing places delegated assignments and identifies closure gaps; it does not choose an interactive session's purpose.
- A parent-session model suggestion is optional user/harness advice, never a prerequisite or a judgment of the current model.

## Active catalog (list prices, $/MTok in/out; cache-read in parens)
- fable 5.1 (`anthropic/claude-fable-5-1`; efforts low/medium/high): 10/50 (0.25).
- gpt astra 6 (`openai-codex/gpt-6-astra`; efforts low/medium/high): 10/50 (1).
- sonnet 5.5 (`anthropic/claude-sonnet-5-5`; efforts low/medium/high/xhigh): 2/10 (0.2).
- opus 5.5 (`anthropic/claude-opus-5-5`; efforts low/medium/high/xhigh/max): 4/20 (0.2).
- gpt 6.1 sol (`openai-codex/gpt-6.1-sol`), luna (`openai-codex/gpt-6-luna`); efforts low/medium/high/xhigh/max. sol: 2/10 (0.1); luna: 0.1/0.5 (0.01). Prompts above 272K input tokens have higher API rates; subscription capacity is not list-price spending.
- deepseek 4.1 flash (`deepseek/deepseek-flash`; efforts low/high): 0.15/0.6 off-peak, 0.3/1.2 peak (0.003).
- grok 4.6 (`xai/grok-4.6`; efforts low/high): 2/6 (0.5).

- GLM 5.3 Flash (`zai/glm-5.3-flash`; efforts high): Z.ai Coding Plan subscription. Compare measured subscription consumption and accepted-task wall time, not an assumed zero cost or API list-price equivalence.
