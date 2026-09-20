---
tags: [task]
next: implement
claimed-by: frontier/0919/route
priority: 1
---

`lib/route.ts`: from (sink, supertag, block, instruction?) to {skill, model, effort}, per the [[routing]] project note. that note and [[model opinions]] (its `## catalog` section) are the data; both are prose/markdown in ~/obsidian and are read at call time, not copied into code.

- keymap: parse the sink × supertag table from routing.md; an instruction overrides the skill. no judgment here.
- selection: jev (see the typesafe-ai skill), not a chat model: it's a choice among a closed set. candidates are every (model, effort) named in the catalog; the judgment is given the block, the chosen skill, the selection and pool sections of routing.md, and the catalog, and asks for the cheapest candidate that clearly suffices. no tables in code.
- pool: `lib/pool.ts` with a `usage(provider)` stub returning 0 and the congestion price formula, so the reader in [[projects/mlegls-pi/issues/pool-aware-routing]] can slot in.
- lib/augment.ts calls route() instead of hardcoding grilling + luna/low; its cli gains an optional instruction argument.

done: `bun lib/route.ts comment fleeting "<block text>"` prints {skill, model, effort}; the augment palette command still produces a comment; `bun test lib/route.test.ts` covers keymap parsing and instruction override against a fixture copy of the table (the model call is not tested).
