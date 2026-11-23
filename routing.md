## Agent model lists

Each agent file's `model:` is a preferred-first list of `provider/model:effort`. A BB provider prefix names a native worker (`codex/gpt-6.2-sol:high`, `acp-antigravity/gemini-4-neon:high`); other entries are Pi models (`openai/gpt-6.2-sol:high`). Mixed lists pick the first entry with delegated capacity left (`allocation.json`); Pi-only lists run as `stance/<agent>`, with Pi selecting the model. On a typed rate-limit from a native worker, the reconciler replaces it from the rest of the list. A `model:<provider>/<model>:<effort>` assignment is exact. Model rationale lives in [docs/models.md](docs/models.md).

## Assignment stances

Pick the stance whose deliverable fits for the lowest wall time to accepted completion at comparable cost, accounting for verification, retries and escalation. Keep trivial known diffs local when handoff costs more than doing them; send missing design outside delegated authority back to shaping.

- `auto-routine`: Decided outcome; routine implementation (even if it needs repo discovery).
- `technical`: Crisp acceptance criterion with hard technical fulfillment (novel algorithms, complex systems, exacting UI).
- `ui`: Unsettled interaction or visual design where taste must be exercised. Use `auto-routine` or `auto` for settled UI changes, `technical` for hard UI engineering; `visual-reviewer` holds rendered acceptance on Opus.
- `auto`: Open approach within delegated authority; the worker owns the how.
- `manager`: Refines a `decompose: true` issue—splits it into outcome-sized ready children, or clears `decompose` when it fits one session.
- `prune`: Subtractive refactoring or simplifying replacement against surviving interfaces.
- `tidy`: Join review—repairs crossing stories at their seams, then behavior-preserving tidying across landed children.
- `research`: Finds and compresses evidence for an upstream decision.
- `reviewer`: Reviews a change against its contract (and driver log if present) and repairs gaps directly; non-visual work.
- `verify`: Drives changed behavior as its user without reading the implementation; writes predictions before first use and records outcomes, frictions, expectations and replayable checks.
- `visual-reviewer`: Reviews and repairs rendered UI work by looking at the screenshots; may also improve the rendered surface's aesthetics. Used by the reconciler when the packet is visual and the diff touches a configured rendered path.

## Continuation actions

Spent tokens are sunk cost; compare remaining cost to accepted completion (cache telemetry, handoff, rediscovery, verification, repair). A provider past its delegated share in `allocation.json` is unavailable for continued delegated work.

- `continue`: Current session can finish within its authority and its warm context is worth keeping.
- `consult`: A bounded decision or specialist read will unblock the warm session via a small handoff packet.
- `replace`: Fresh session from an updated issue and compacted/OM handoff beats keeping the current session.

## Session economics

Route model/effort at fresh-session boundaries (consult or replace rather than switching models mid-history). Fresh sessions inherit no memory, uncommitted files, or prompt cache—rely on the issue and a concise handoff.

## Active catalog (list prices, $/MTok in/out; cache-read in parens)

- fable 5.1 (`anthropic/claude-fable-5-1`; low/medium/high): 10/50 (0.25).
- gpt 6.2 astra (`openai/gpt-6.2-astra`; low/medium/high/xhigh/max): 8/40 (0.4).
- sonnet 5.5 (`anthropic/claude-sonnet-5-5`; low/medium/high/xhigh): 2/10 (0.2).
- opus 5.5 (`anthropic/claude-opus-5-5`; low/medium/high/xhigh/max): 4/20 (0.2).
- gpt 6.2 sol (`openai/gpt-6.2-sol`), luna (`openai/gpt-6-luna`); low/medium/high/xhigh/max. sol: 2/10 (0.1); luna: 0.1/0.5 (0.01). Prompts over 272K input tokens carry higher API rates; ChatGPT subscription usage is separate from API list price.
- deepseek 4.1 flash (`deepseek/deepseek-flash`; low/high): 0.15/0.6 off-peak, 0.3/1.2 peak (0.003).
- grok 4.6 (`xai/grok-4.6`; low/high): 2/6 (0.5).
- GLM 5.3 Flash (`zai/glm-5.3-flash`; high): Z.ai Coding Plan subscription; compare actual subscription consumption and wall time rather than API list prices.
