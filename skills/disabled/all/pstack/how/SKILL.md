---
name: how
description: "Use for code walkthroughs or questions about how code works, ownership, placement, or layering."
---

# How

Explore the codebase and explain how X works, at the level a senior engineer onboarding onto the subsystem needs: a working mental model, not annotated source code.

Two modes: **explain** (default) and **critique** (the user asks for issues, problems, or improvements, not just understanding).

## Explain mode

1. **Scope.** If the question is ambiguous, state your best-guess interpretation and proceed; don't ask. Assess complexity:
   - **Simple** (single module, narrow question): one agent explores and explains in a single pass, per `references/explainer-prompt.md`.
   - **Complex** (subsystem spanning files or services, cross-cutting feature, architectural overview): explorers first, then an explainer. When in doubt, lean simple; spawn explorers later if the explainer hits a wall.
2. **Explore** (complex only). Decompose into 2-4 non-overlapping angles (e.g. data model / request path / configuration). Spawn explorers in parallel on a fast cheap model where the harness offers one, each given `references/explorer-prompt.md` plus its angle. Each reads actual code rather than guessing from file names, and stops only when it can trace input to output without hand-waving a step. Overlap between explorers is fine; the explainer reconciles.
3. **Synthesize** (complex only). One explainer agent gets all findings plus `references/explainer-prompt.md` and writes the explanation. The output contract (Overview / Key Concepts / How It Works / Where Things Live / Gotchas) lives in that template.
4. **Present.** Light edits only; the explainer's communication is the product.

## Critique mode

1. Run the full explain flow first. Understand before critiquing.
2. Spawn three critics as parallel agents on distinct models or tiers where the harness offers them, so priors differ. Each gets the explanation, the relevant file paths, `references/critic-prompt.md`, and `references/critique-rubric.md`.
3. Judge as lead per the **code-review** skill's verdict layer (its `references/lead-judgment.md`): bucket findings **Act on / Consider / Noted / Dismissed**. You're a pragmatic lead, not an aggregator.
4. Present the explanation first, standing on its own; the critique verdict below it.
