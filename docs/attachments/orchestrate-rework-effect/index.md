# Orchestrate rework effect — first-use drive

## Setup

- Tested revision: `4c95f4a284c8939418b2f34be68d21570785473b`.
- Persona: local researcher reading the ticket and running its supplied reproduction command; no authentication.
- Deployment: static local CLI analysis in this worktree, `/Users/mlegls/dev/mlegls-pi__worktrees/orchestrate-rework-effect-drive`. No service, port, browser or deployed state.
- Entry point: `python3 docs/analysis/orchestrate-rework-effect/metrics.py`.
- Inputs: existing `~/.local/share/pi-board/log.jsonl` and `~/.pi/agent/sessions`; both exist and are readable. No seeding, selector reuse or destructive setup is required. Inputs are shared read-only historical records, not checkout-owned writable state.
- Visual: false; no screenshots.

## Predictions — recorded before opening the report or running the CLI

These predictions come from the ticket and setup command. The required peer-board read exposed the implementer's conclusions first; this is not a fully blind trial. No source, diffs, tests or fixtures were read.

1. **Per-run comparison:** I expect the supplied command to complete successfully and expose a reproducible table of runs grouped by board topic prefix, separating 09-14..15 from 09-16..22. Every run should have worker count, usage cost, checkpoint count, never-done fraction and distinct dispatching-parent cwd count.
2. **One-handle hypothesis:** I expect to be able to tell whether after-runs have exactly one dispatching-parent cwd, and whether that differs from baseline. A negative or non-discriminating result is acceptable; the story is measurement, not proving the hypothesis true.
3. **Never-done and checkpoints:** I expect the factor-finish baseline exemplar to be visible, with a stated denominator and rule for counting never-done. The extended after-window should be explicit rather than silently stopping at 09-16.
4. **Cost and interpretation:** I expect era comparisons and an explanation of cost ownership (worker versus parent), list-price estimates, missing-data limits, roster changes including opus leaving, and later routing changes. The 09-23 paseo campaign should stay outside the measured corpus.
5. **Reproduction usability:** I expect the command to say where its result is, and repeated runs over unchanged historical inputs to reproduce the same measurements without services or credentials.

## Session log

- 2026-09-30: Read the ticket, evidence rules and required peer board. Confirmed clean worktree at the tested revision and existence of the supplied entry point and historical input locations. Did not inspect the script.
- Readiness at this point: files are available; actual CLI readiness remains to be established by execution.
- First execution completed successfully (exit 0) without setup beyond the supplied command. Captured stdout/stderr in [cli-first.txt](cli-first.txt). It prints its table and summaries to stdout; it does not print an output-file destination. `git status` showed no tracked product file changes.
- Opened the ticket-linked [research report](../../research/orchestrate-rework-effect.md) and published [metrics.tsv](../../analysis/orchestrate-rework-effect/metrics.tsv) as user-facing deliverables. Found material inconsistencies before repeating execution:
  - Report era summary says **19** before-runs / **1127** sends / **177** worker sessions / **$1260**; CLI and TSV say **20 / 1134 / 178 / $1261**. Report itself displays 20 before rows plus 9 after rows.
  - Report says every run has one parent cwd except orca-probe. The displayed table and CLI include multiple zero-cwd rows, `verify-final` with **3**, and orca-probe with **2**. Seven of nine after-runs have **0**, not 1.
  - Report says no after-run has nested topics; CLI and TSV show `materials-closeout` with **1**. Its report row instead says **0**.
  - Report says the 09-18 audit's worker-topic count 217 reproduces exactly. CLI and TSV explicitly show **218 (target 217)**.
  - Report shows orca-probe parent cwds/sessions **2/2**; CLI and TSV show **2/1**.
- New expectation formed: before accepting any conclusions, the report, TSV and fresh execution should agree on the same corpus and metric definitions. This expectation is currently **not met**.
- Second execution also exited 0. Captured [cli-repeat.txt](cli-repeat.txt). Compared the public table rows (parsing the displayed model dictionaries only to disregard key order): both executions agree with each other and the published TSV. The full stdout also agrees after canonicalizing model-dictionary key order. See [comparison.txt](comparison.txt). No source inspection or test implementation was used.
- Summed the displayed per-run counts as a user cross-check: before **13/183 (7.10%)** never-done handles and **47** checkpoint sends; after **2/40 (5.00%)** and **7**. These are sums of per-run handle counts, not deduplicated session counts (178 before / 40 after in the CLI era summary). The report does not give the before fraction explicitly.
- No servers, browser sessions, containers, tunnels or outside-worktree processes were started. Shared historical data was not modified. No product repair was attempted.

## Stories and expectations

| Story / initial expectation | Outcome | Expectation | Observation |
|---|---|---|---|
| Per-run before/after measurement table | held | met | CLI exposes 29 rows with requested measures; never-done fractions can be calculated from `never/workers`. Both windows and the factor-finish exemplar are present. |
| Exactly-one-handle hypothesis can be evaluated consistently | failed | not met | Output exposes counts, but narrative's “every run … exactly one” conclusion conflicts with its own table and CLI: after cwd counts are seven zeros, one one, one two. A zero observed board sender is not automatically proof of zero dispatchers. |
| Checkpoint/never-done measurement over extended window | held | met | Rule is stated as worker handle with no done-tagged send; factor-finish has 115 workers / 8 never / 37 checkpoint sends. After extends through 09-21 with report explaining zero sends on 09-22. No claim was independently made that all sessions on silent days are absent. |
| Cost comparison and bounded interpretation | failed | partly met | List-price and shared parent-session costs, roster/opus change, run mix, routing dates and out-of-scope paseo pointer are stated. But era totals and prior-audit agreement differ from reproducible output; nesting claim also differs. Missing counts are visible in CLI/TSV but not explained in the report. |
| Reproducible entry point | held | partly met | Supplied command succeeds twice and reproduces TSV numerically. It prints stdout, not a result-file destination; dictionary-key order changes make raw text comparison noisy. |
| New expectation: narrative agrees with published/fresh measurements | failed | not met | Five concrete contradictions recorded above persist across repeated execution. |

## Frictions

- “Raw table” TSV also contains blank lines, prose sections and aggregate summaries, so it is not a single ordinary TSV dataset. I had to delimit its table manually to compare it.
- CLI model columns and summaries contain Python dictionaries, with unstable key order. Measurements reproduce, but byte-for-byte outputs do not.
- `parent_cwds` is displayed as zero without clearly distinguishing an unobserved dispatching parent from a genuinely absent parent; the prose then claims all counts are one.
- Report says 30 curated prefixes, displays 29 measured rows, and summarizes only 28 runs (19+9). No reconciliation is given.
- Fractions are provided implicitly as done/never counts, not directly per row. The reader must know `never/(done+never)` and not confuse handle totals with deduplicated session totals.
- `missing=5` and `null_or_tmp=8` are visible without a reader-facing account of which evidence is unavailable or how it limits cost/parent attribution.
- Tooling: `tracker --help` is unavailable on PATH. Durable issue: [tracker-command-unavailable-orchestrate-drive.md](../../issues/tracker-command-unavailable-orchestrate-drive.md). This did not block the product surface.

## Replayable checks for review

These are proposed observable checks, not tests written by the driver.

1. **Historical reproducibility:** From this checkout run `python3 docs/analysis/orchestrate-rework-effect/metrics.py` twice with unchanged historical input files. Accept successful exits and equal measurements/model counts for every row and era, ignoring dictionary order. Compare with the published TSV; all values should agree. This currently holds.
2. **Narrative era totals:** Compare the CLI's `# era totals` with the report's era paragraph. Accept one explicitly consistent corpus with the same run, send, worker-session and cost counts (or an explicit explanation of exclusions). Current CLI: before 20/1134/178/$1261, after 9/100/40/$153; report differs before.
3. **Literal parent-cwd claim:** Read `parent_cwds` for all after rows and compare the report's one-handle conclusion. Accept a conclusion that reflects measured 0/1/2 values and separates unknown/unobserved dispatchers from verified counts. Current distribution: seven zero, one one, one two. Also reconcile baseline `verify-final=3` and orca-probe parent sessions `1`, not `2`.
4. **Nested after-run claim:** Read materials-closeout's `nested_topics` from fresh CLI, published TSV and report row/prose. Accept identical counts and a conclusion consistent with them. Current CLI/TSV 1; report 0 and “no 09-16+ run has any.”
5. **Prior-audit check:** Compare fresh CLI's final `worker_topics` value against report's reproduction claim. Accept either matching 217 or an explicitly reported deviation/definition difference. Current result 218 (target 217), whereas report claims exact reproduction.
6. **Fractions and checkpoints:** For each row compute `never/workers` when workers > 0; zero-worker rows should be not-applicable, not a fabricated fraction. Sum checkpoint messages per era separately from checkpointed-handle counts. Accept consistent denominators and exposed comparisons; current public rows give before 13/183 and 47 sends, after 2/40 and 7 sends.
7. **Limits and scope:** Read the report alongside CLI missing/parent-cost columns. Accept explicit list-price and shared-session caveats, missing-data bounds, roster changes and routing timing, with 09-23 excluded from measured era totals. Costs/roster/routing/paseo caveats are present; missing-data explanation is absent from the report.

## Limits

This is a first-use CLI/report drive, not an independent reimplementation or source audit. Agreement between CLI and TSV does not validate corpus joins or inference of dispatching parents; reviewer verification is needed for those. Required board coordination exposed implementer findings before execution. Historical input paths are shared, mutable local archives; the evidence records the observed outputs, not a private-data copy.
