---
tags: [task]
next: prototype
parent: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

autoread returns understanding, not snippets: the show-me forms — labeled file tree, call tree from the ticket's identifiers outward, component tree where there is UI, a sequence diagram for the story path, pseudocode for the one function that matters — with `path:line` only as leaves. these are Kruchten's 4+1 views; the only freeform work is one-line labels per node and pseudocode, both cacheable by content hash.

fully LLM-powered on deepseek flash first: a 100-file neighborhood read three times with caching is ~$0.05 on a metered pool, so reader cost is noise and the gain is entirely in what enters the parent. per-symbol labels written to a sidecar keyed by (path, symbol, hash) so the second map of a project costs nothing.

done: the agent prompt rewritten, five recent tickets mapped, parent context per ticket compared against what the original sessions read. then decide which parts to make deterministic ("[[projects/mlegls-pi/issues/map-projection]]").

holes:
- whether the parent calls it or a dispatch script does; in scripts it is the first step, memoized on (query, git ref).
- `ask(question, scope)` for reading-comprehension questions a projection cannot answer, scope pre-narrowed by the map; same agent, different prompt, or a second function.
