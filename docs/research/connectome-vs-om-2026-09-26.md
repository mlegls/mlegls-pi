# Connectome versus observational memory — September 26

Luna's cache behavior improved after the settings change, but Opus's did not. Connectome is not yet as cache-friendly as the OM-era sample. Smaller contexts can nevertheless make foreground input cheaper. Memory production remains a separate, substantial cost, especially on Opus.

## Exposure and limits

Read-only snapshot through approximately 11:19 UTC. The installed context-manager reports 0.10.1. “Trial” means a per-session compile joined to a foreground request within 30 seconds, after a `config:effective` record with slack 0.25 and reach 64k. This verifies configuration exposure, not a separate library hysteresis patch. Trial requests begin at 05:06 UTC. Current settings have a 160k budget, not the 200k in the earlier trial note; most compile logs report 176,384 including response reservation. Some Sol requests retain the older budget.

OM cohort: September 20–24 requests in transcripts containing OM ledger records or OM compaction details. Baseline Connectome: September 25 through September 26 05:00, with a joined compile but without verified trial settings. These are descriptive cohorts, not randomized or task-matched comparisons. Models, session ages, projects, worktree assignments, and budgets differ. An exact-cwd/session-age common-support check finds no overlap for Luna or GLM; it cannot establish causal savings. A ledger record identifies an OM-bearing session, not proof that every request used the same OM settings.

## Foreground context economics

Input cost includes fresh input, cache reads, and cache writes; excludes generated output and memory workers. Dollar values are usage-record estimates, not invoices. Cache share is token-weighted.

| Model / cohort | Requests | Mean context | Cache share | Fresh/write tokens per request | Input $ / 100 requests |
|---|---:|---:|---:|---:|---:|
| Luna / OM | 7,296 | 99,429 | 97.63% | 2,361 | 0.121 |
| Luna / baseline | 8,036 | 100,046 | 93.73% | 6,271 | 0.162 |
| Luna / trial | 1,943 | 83,131 | 95.45% | 3,785 | 0.117 |
| Opus 5.5 / OM | 10,085 | 130,942 | 97.48% | 3,294 | 4.200 |
| Opus 5.5 / baseline | 2,251 | 117,501 | 94.26% | 6,742 | 5.586 |
| Opus 5.5 / trial | 1,017 | 127,857 | 93.02% | 8,929 | 6.843 |
| Sol / OM | 11,203 | 94,613 | 98.64% | 1,291 | 2.125 |
| Sol / trial | 280 | 37,149 | 93.88% | 2,275 | 1.152 |
| GLM / OM | 3,900 | 116,081 | 98.57% | 1,662 | 0.303 |
| GLM / trial | 227 | 68,960 | 96.82% | 2,195 | 0.233 |

Luna's trial input cost is roughly back to OM's level, despite poorer cache reuse, because context is smaller. Opus's trial input cost is 63% above OM. Sol/GLM have smaller, cheaper contexts but worse cache reuse; their trial samples are small.

## Folds and recaching

For same-model/provider successful adjacent transcript requests less than 60 seconds apart, define prefix shortfall as `max(0, min(previous context, current context) - cacheRead)`. This is a proxy, not reconstructed cache invalidation. Unlike the earlier audit, this quick extractor does not verify branch ancestry; compaction transitions are retained deliberately.

- Luna: baseline folds on 222/7,848 rapid transitions (2.83%); trial 14/1,899 (0.74%). Mean shortfall per transition falls 4,467 → 1,922 tokens, still above OM's 766. Mean shortfall on folds remains large: 130k → 142k.
- Opus: baseline folds on 19/2,077 transitions (0.91%); trial 16/955 (1.68%). Mean shortfall rises 2,541 → 3,874 tokens, versus OM's 53. Fold shortfall falls 228k → 176k, but remains far above the nominal 64k reach.

The reach is not a provider-token invalidation cap. Solver overrides, token estimation, and adapter/provider cache behavior can all separate the internal limit from observed recaching. These numbers do not isolate which mechanism caused each event.

## Memory workers

Trial memory writes for the corresponding session/model pairs, including output:

| Model | Foreground $ | Memory $ | Memory / foreground |
|---|---:|---:|---:|
| Opus 5.5 | 79.69 | 100.77 | 126% |
| Luna | 2.82 | 0.65 | 23% |
| Sol | 3.94 | 0.41 | 10% |
| GLM | 0.59 | 0.19 | 32% |
| Astra | 43.28 | 15.74 | 36% |

This includes memory writes after verified trial initialization, not just writes immediately preceding a matched foreground call. Named lives are excluded. Opus's 359 memory calls record 16.18M cache-write tokens, 2.36M cache-read tokens, and 969k output tokens: sharing the session identity does not make these calls cheap cache hits.

OM observer/reflector/dropper usage is not available in the session ledger inspected here. Its recorded entries contain memories and coverage, not worker usage. Therefore **OM memory cost is unknown, not zero**, and these data do not establish a full all-in cost ratio. Current OM configuration selects Luna medium; Connectome writes memories on the live model. Historical OM configuration exposure is not recorded by this audit.

## Assessment

The settings are promising for Luna's foreground cost, not a general cache fix. Opus remains the clear cost problem: foreground input is more expensive than in the OM sample, and memory writes exceed its foreground spend. Before replacing the backend, the highest-value distinction is expensive foreground reasoning versus memory-production model; the adapter currently does not honor `compressionModel` as a separate provider/model selection.

OM's inspected implementation keeps observations in a ledger and injects their projection at compaction, preserving the foreground prefix between compactions. Connectome trades that stability for automatic, finer-grained folding. Wider hysteresis can reduce fold frequency; it does not by itself fix memory-worker cache reuse or bound provider-visible recaching. Recall quality, manual compaction burden, and accepted task completion were not measured.

Reproduce: `uv run python docs/research/connectome-om-costs.py`. Numeric metadata is written to `/tmp/connectome-om-costs.json`; no transcript bodies are exported. Production settings and stores are not modified.
