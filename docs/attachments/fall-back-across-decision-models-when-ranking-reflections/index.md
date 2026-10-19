# Decision-model fallback for reflection ranking: implementation evidence

Nonvisual library change. `rankReflections` (extensions/context/om/hooks/rank-reflections.ts) tries `RANKERS` in order on OpenRouter within one 6 s deadline (3 s per attempt), and falls back to newest-first only when all of them fail or no OpenRouter credential exists. Every attempt is written to `<agent dir>/observational-memory/reflection-rank.ndjson`, which is always on, and also to the OM debug log when that is enabled.

## Model order (checked 2026-10-20, OPENROUTER_API_KEY only)

Each model got one call with two bool and two score questions about a constraint and an ordinary note:

| Model | ms | bool p (constraint / ordinary) | score (constraint / ordinary), confidence | cost $ |
| --- | --- | --- | --- | --- |
| ~typesafe/jev-latest | 715 | 0.89 / 0.11 | 1.81 (0.73) / 0.10 (0.86) | 0.0000217 |
| cloudflare/clef-flash | 593 | 0.77 / 0.04 | 0.64 (0.10) / 0.45 (0.23) | 0.0000091 |
| cloudflare/clef | 893 | 0.97 / 0.02 | 1.78 (0.66) / 0.12 (0.82) | 0.0000183 |
| inception/mercury-decide | 893 | 0.999 / 0.0005 | 1.99 (0.98) / 0.02 (0.97) | 0.0000071 |
| microsoft/microsoft-decision-1 | 1119 | 0.94 / 0.006 | 1.98 (0.98) / 0.43 (0.38) | 0.0000081 |

All five answered both question types. The order is Jev, then Clef, then Mercury Decide. Clef Flash's scores barely separated the two notes and had low confidence, so it isn't in the list. Mercury Decide comes from a third family.

## Availability gap

pi 1.2.0, which runs the extensions, lists all of these models as available with only OPENROUTER_API_KEY. The gap the ticket saw came from this repo's pinned dev dependency, pi 1.0.0. Its bundled openrouter.json has no Clef, Mercury Decide (paid), Microsoft or GPT-6 Luna classifiers, so scripts run under bun (`lib/decide.ts`, the tracker CLI, these drives) could not see them. The dev dependencies are now pinned to 1.2.0. `pickClassifier` returns exactly the requested model or nothing. `decide` and optmem's scorer now report a requested model that isn't available instead of quietly answering with Jev.

## Live run

`bun docs/attachments/fall-back-across-decision-models-when-ranking-reflections/try-fallback.ts` (TYPESAFE_API_KEY and CLOUDFLARE_API_KEY unset) uses the fixture pool of 14 reflections and forces Jev to fail:

- `attempt_failed` openrouter/~typesafe/jev-latest: "forced failure of the first ranker"
- `ranked` openrouter/cloudflare/clef: **1,462 ms**, 4,529 input tokens, catalogue cost **$0.000190**
- Order starts with role and rule. The rendered output at a 600-token budget keeps role, rule, f9 and f10.

## Checks

- `bun test extensions/context/om`: 10 pass. New tests: a failing model hands over to the next, and every model failing gives newest-first.
- `bunx tsc --noEmit`: exit 0, with pi 1.2.0 dev dependencies.
- Offline replay `docs/attachments/rank-omitted-reflections-with-jev/try-compaction.ts`, with its scripted model moved to OpenRouter Jev, passes. A hung availability lookup now falls back at the 6 s deadline (6,001 ms).
