---
tags: [task]
next: done
priority: 1
---

`lib/route.ts`: from (sink, supertag, block, instruction?) to {skill, model, effort}, per the [[routing]] project note. that note and [[model opinions]] (its `## catalog` section) are the data; both are prose/markdown in ~/obsidian and are read at call time, not copied into code.

- keymap: parse the sink × supertag table from routing.md; an instruction overrides the skill. no judgment here.
- selection: jev (see the typesafe-ai skill), not a chat model: it's a choice among a closed set. candidates are every (model, effort) named in the catalog; the judgment is given the block, the chosen skill, the selection and pool sections of routing.md, and the catalog, and asks for the cheapest candidate that clearly suffices. no tables in code.
- pool: `lib/pool.ts` with a `usage(provider)` stub returning 0 and the congestion price formula, so the reader in [[projects/mlegls-pi/issues/pool-aware-routing]] can slot in.
- lib/augment.ts calls route() instead of hardcoding grilling + luna/low; its cli gains an optional instruction argument.

done: `bun lib/route.ts comment fleeting "<block text>"` prints {skill, model, effort}; the augment palette CLI produces a comment; direct probes cover keymap parsing, instruction override, catalog expansion, and congestion pricing. No persistent tests (implementation-session constraint).

## verification

2026-09-20: live Jev selection returned `{skill:"grilling", model:"deepseek/deepseek-flash", effort:"low"}`. The live catalog expands to 37 model/effort pairs, including metered overflow. Keymap, literal instruction override, half/full-ceiling price probes passed.

`bun lib/augment.ts comment ~/obsidian/augment.md 36` added a nested comment in 36.0s. Removed only that test comment; the note matches its pre-run contents exactly. Existing block-change checks and comment validation remain intact.

## frictions

- Catalog aliases were insufficient to enumerate executable choices. Catalog bullets now declare backticked provider/model IDs and slash-separated effort sets; `overflow under` a backticked provider prefix expands the same model suffixes. Selection uses the existing `lib/decide.ts` Jev integration and its credentials.
- Two live attempts were rejected as invalid comment output; neither changed the note. A non-writing probe produced valid prose. The prompt now explicitly forbids delimiter sequences even in syntax examples; the subsequent live run succeeded. Repeated-run reliability is not measured.
- Observed exec friction: combining an unfiltered `pi --list-models` with other inspections in one `show(sh(...))` exhausted the output budget and hid the later inspections. Workaround: focused reads in separate calls. Proposed improvement: per-command retained output blocks/paging rather than one shell stdout blob. Object-form `edit([{...}])` and `write()` handled TypeScript template literals without quoting failures.
- `usage(provider)` remains a zero stub: its contract is fraction of that actual provider ID’s ceiling, with metered overflow at zero. Real pool readings and escalation are separate work.
