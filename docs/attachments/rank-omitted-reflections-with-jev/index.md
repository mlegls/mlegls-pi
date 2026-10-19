# Jev reflection ranking — implementation evidence

Source revision: `2ec90000` (base `3344c0c3`). Nonvisual library/compaction journey; no browser or server required.

## First-use setup

Run from this repository's checkout with its normal Bun dependencies installed (`mise run setup` if needed).

- Offline entry point: `bun docs/attachments/rank-omitted-reflections-with-jev/try-compaction.ts`. Scripted Jev, fixture session `compaction-ranking-smoke`, 14 reflections and one current-work observation. It owns temporary ledger/debug directories under this checkout's `.wm/` and deletes them on exit. No user ledger writes or credentials.
- Live entry point: `bun docs/attachments/rank-omitted-reflections-with-jev/try-ranking.ts`. Uses pi's normal provider authentication: `TYPESAFE_API_KEY` or `OPENROUTER_API_KEY`, or an already-configured pi provider credential. No separate persona or remote deployment. The prepared worker resolved OpenRouter's `~typesafe/jev-latest`; no secret files are needed from this worktree. It submits only the committed synthetic fixture, prints usage and retained ids, and changes no ledger state.
- In an interactive pi session, reload/restart the extension after updating it. The change applies at OM compaction, not ordinary rendering.

Both entry points were opened successfully. The live provider returned `stop`; the offline fixture reached async preparation and the synchronous compaction renderer.

## Observations

| Claim | Action and observed result |
| --- | --- |
| Renderer uses supplied priority, retains chronological display | `bun test extensions/context/om`: priority includes old `f0`, excludes ordinary `f1`, preserves original display order. |
| Jev preservation before ordinary recency | Scripted Jev test puts role and constraint ahead of 12 newer ordinary reflections. Offline compaction retains role and keeps all 14 reflections in compaction details (omission changes context, not the ledger). |
| No Jev when reflections fit | Offline compaction raises the budget from 600 to 10,000; no credential lookup or classification occurs. |
| No credentials, error, timeout | Offline fixture tries each condition: newest-first order in every case, three `reflection_rank.fallback` events in the session-scoped OM debug log. Missing credential/error returned in under 1 ms; deliberately hung availability returned in 4,003 ms. Logs were inspected before fixture cleanup. No regex fallback. |
| Live Jev keeps role | OpenRouter `~typesafe/jev-latest`, one call over 14 reflections. Priority begins `role`, `rule`; rendered ids: `role`, `rule`, `f10`, `f11`; 10 omitted. Newest-first instead retains `rule`, `f9`, `f10`, `f11`, losing role. |
| Latency/cost | Live ranking took **1,101 ms** after runtime setup, including credential/model selection. 4,043 input + 516 output tokens. Runtime-reported catalog cost **$0.000169806 USD** ($0.042/M input; output free), not a billing receipt. |
| Required checks | `bun test extensions/context/om`: **8 pass, 0 fail**. `bunx tsc --noEmit`: exit **0**. |

The live entry point can repeat the measured call; answers, timing and usage may vary. The offline entry point repeats compaction/fallback/logging observations without a provider. This is implementation evidence, not an independent driver's acceptance packet.
