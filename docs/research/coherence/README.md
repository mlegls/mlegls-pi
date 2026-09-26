# Memory-boundary coherence audit — 2026-09-26

The boundary screen does not establish a coherence winner. Both backends have examples of continuing work correctly. Connectome's folds did not produce an obvious local derailment in the screened windows. OM preserves useful evidence qualifiers and offers explicit source recall, but it is not immune to factual distortion: one observation says a review was graded “Hard” while its cited result says “简单” (Easy).

This is a short-horizon observational audit, not an overall memory-quality score or proof that the backends are equivalent. It does not yet justify paying Connectome's additional cost for better coherence.

## Scope and method

- **40 boundaries:** 20 OM compactions, 20 Connectome folds; ten Luna and ten Opus 5.5 in each cohort. Cases are frozen in `sample.json`.
- Candidates come from `../connectome-om-costs.py`'s snapshot through approximately September 26 11:19 UTC. OM is September 20–24; Connectome means verified slack 0.25/reach 64k initialization, not verification of a separate hysteresis code patch. See `../connectome-vs-om-2026-09-26.md`.
- OM candidates additionally require the actual compaction's `details.type == "om.folded"`. Connectome candidates require the joined solver record to report moves. Both need six subsequent assistant messages.
- Sample without outcome inspection: spread Connectome cases across sessions, earliest first; select same-model OM boundaries preferring unused sessions, then nearest request ordinal. Shuffle case order with seed 20260926. Median request ordinal: OM 129, Connectome 125. This is approximate session-stage matching, not workload matching.
- Screen abbreviated pre/post text and tool-call windows for plan loss, repeated completed work, ignored corrections, forgotten constraints, and unsupported claims. Expand suspicious cases to exact source entries; inspect selected memory bodies and their provenance. The complete packets remain local. This is **screening all 40 plus targeted source checks**, not exhaustive proposition-by-proposition validation of all memories.
- Read-only: no task replay or memory-model calls, no production setting/store changes. Chronicle stores were copied before opening. All 20 historical snapshots opened without recovery; summary creation times were checked against the boundary. Follow-up paths were checked for linear parent ancestry and boundary IDs for uniqueness.

### Important limitations

**The boundary types differ dramatically.** In 19/20 OM cases the last conversation message before the resumed assistant is a user-role message; for Connectome it is 1/20. Several OM messages explicitly restate scope, blockers, or next steps. These include supervisor messages, not necessarily human interventions. The count does not establish that OM required the help, but prevents interpreting immediate continuation as an unaided memory test.

**The samples are clustered.** OM has 20 session roots. Connectome has 12 session IDs but only ten distinct initial-user-message roots: seven Luna tasks and three Opus tasks. Several design-review transcripts share history. There are 114 unique Connectome follow-up assistant entries, versus 120 OM; overlapping six-message windows are not independent trials.

**Recent context protects the tested behavior.** Connectome retains a recent verbatim window, and OM compaction also retains a tail. Continuing the next tool operation often does not require retrieving anything from compressed history. Six assistant messages are enough to catch a gross discontinuity, not enough to test long-range recall, topic recovery, selective forgetting, or narrative lock-in.

**Exposure is asymmetric.** OM retains its actual compaction summary and source IDs. Connectome retains historical summaries, chunks and resolution state, but `calls.jsonl` stores counts, sizes and timings—not rendered messages. No historical compile was rerun: it could choose a different cut or trigger work. A stored summary, particularly a speculative higher-level one, is not evidence it was shown. The inspected higher-level memories below are explicitly about representation, not demonstrated model exposure.

Case shuffling did not make this blind: dates, tools and memory format reveal the backend. One reviewer, no calibrated inter-rater agreement. No failure-rate percentages are warranted.

## Source-checked findings

### 1. Local operational continuity survives both mechanisms

**Connectome B14 — correct retry, not forgotten work.** Just before the fold, entry `43f407be` attempts a grouped-renderer edit. Tool result `510786ab` says a JSX line was parsed as a hunk header and **“Nothing was modified.”** Immediately after the fold, `4c97be70` retries with escaped JSX sigils; `6fa0b8e7` confirms the edit applied. The repeated code is a proper recovery, not duplication caused by forgetting. Original transcript lines 175–179.

**OM B23 — same distinction.** Before compaction, terminal creation (`20b99924`) fails with `notifyOnOutput must be a string` (`c2596e08`). After compaction, `5a65881c` removes the invalid option, obtains a running terminal, then uses its proxy successfully (`2b3f3ea8`, HTTP 200). Lines 477–483. A duplicate-command detector alone would misclassify both cases.

**Connectome B16 — unfinished evidence work carries across.** A pre-fold result reports a 0.53 Jev drift finding and a completed but omitted test result (`ing-77fa8b2aca78f547`). The first post-fold call investigates that exact drift claim, and a later call retrieves that exact omitted test output rather than claiming it passed from the skim. Lines 304–324. This demonstrates local state continuity; the relevant material may still be in the raw tail.

### 2. OM can preserve epistemic scope, but its factual labels can still drift

**OM B02 — useful qualification survives.** The compaction summary distinguishes seeded cards from actual retrieval, retrieval from grading, and source inspection from observed restore confirmation. For example, observation `02ca18ab1d7e` retains both concrete reasons the restore fixture is ineligible and the instruction not to synthesize turns. After the boundary, `ff6de091` reports restore as explicitly unobserved, repeats the exact reasons, and does not claim acceptance. The latest supervisor message also reinforces that limit, so this is not proof the summary alone caused the good behavior.

**The same memory has a concrete factual error.** Observation `d99b030bcb7f` says:

> then graded Hard; the UI advanced to card 2 of 2 and recorded 简单.

Its cited source entries are `d94d8c74` and `b366a81b` (lines 312–313). The action reveals an answer and clicks “继续 →”; the exact returned UI text is **“已记录：简单”**. The memory introduces “Hard” despite recording the contradictory result in the same sentence. This is an observation-content error, not demonstrated downstream behavioral harm. It is not a measured comparative hallucination rate.

The provenance is useful: OM's `sourceEntryIds` let this claim be checked directly. The compaction prompt exposes memory IDs and a `recall(id)` tool. No `recall` calls occur in the sampled six-message OM continuations, so availability should not be confused with effective use.

### 3. Corrections near boundaries are not automatically memory failures

**OM B08:** the supervisor narrows shared-operation edits after compaction. But the 17-file formatter call, including `operations.tsx`, is already at line 458, before compaction; the scope concern did not originate at the boundary. The continuation removes the expansive changes. This may be a workflow/scope problem, not evidence of memory-induced scope loss.

**OM B35:** the supervisor asks for actual provider-access testing rather than configured presence. The pre-boundary report (`6b492798`, line 408) already explicitly says “access not tested” and “provider access remain unobserved.” It should not be scored as forgetting a successful test or falsely claiming success. Another supervisor message then explicitly supersedes the stop instruction; the continuation follows it.

**Connectome B40:** the source-attribution work labels the stepladder “not Commons” while admitting unknown upstream provenance. That overstatement is already written before the sampled fold (lines 229 and 235); it is not introduced by this fold. Elsewhere in the sampled design-review lineage, B03 follows the maintainer's Commons clarification and locates attribution. That is an ordinary correction workflow, not proof that memory created or repaired the original error.

## Qualitative differences the retained artifacts support

**OM is an evidence ledger.** Inspected summaries expose timestamped, relevance-tagged observations, explicit “not yet verified” statements, and IDs resolving to source entries. This makes individual claims easier to contest. It can still contain redundant historical states, incorrect labels, or conflicting observations; structured memory is not inherently faithful.

**Connectome is closer to a sequence of task handoffs.** Inspected B14/B16 summaries carry the current plan, constraints, changed files, outstanding steps, and tooling friction in first person. They explicitly distinguish proposed directions from implemented changes. B16's stored higher-level memories preserve the unresolved ownership of appearance persistence and warn against silently choosing a storage owner; B14 preserves the distinction between a component fixture and actual Application first use.

That form may be helpful for resuming work, but it also embeds temporally scoped instructions: “I have not edited…”, “First inspect…”, “Wire … to …”. Old plans can remain alongside newer ones. This is a **stale-plan reinforcement hypothesis**, not an observed failure: these higher-level summaries may be speculative and were not proven to be rendered. OM's chronological ledger also requires reconciling obsolete state.

Both systems retain underlying provenance. The present Connectome adapter registers no model-facing recall tool, whereas OM offers one. That is a concrete affordance difference, not a demonstrated difference in successful recall. Connectome's `/connectome` inspection command is not equivalent to a model-facing source-recovery tool.

## Decision

Keep coherence and economics separate for now. This screen provides no positive evidence that Connectome buys enough quality to offset its measured expense, and no clear evidence of a gross local-continuity regression either. OM has a demonstrated auditability advantage in this integration; Connectome has automatic mid-task folding and handoff-like memory. Their deeper quality tradeoff remains unmeasured.

A discriminating next experiment is paired continuation from the same history where the next action depends on an **older corrected decision outside the raw tail**. Include a rejected plan, a revised constraint, an unverified claim, and a topic detour. Check exact source-grounded obligations, not fluent prose or a generic coherence score. Keep the foreground model fixed and account for memory-generation cost. That replay was not run in this audit.

## Reproduction

From the repository root:

```sh
uv run python docs/research/coherence/extract.py
bun docs/research/coherence/store-snapshots.ts
uv run python docs/research/coherence/validate.py
```

The frozen sample needs the retained local Pi transcripts; Chronicle inspection additionally needs the corresponding retained stores and installed native library. `/tmp/coherence-audit/manifest.json` resolves each case to a transcript path; `Bxx.json` contains the ancestry and follow-up entries, and `Bxx-store.json` the historical store state. Compact `.txt` views explicitly mark truncation; use full entries before making exact claims. No transcript bodies are committed. `extract.py --resample` instead selects from `/tmp/connectome-om-costs.json`; it does not overwrite the committed sample.

See `cases.md` for the complete screening register. “No flag” means no obvious issue in that abbreviated window, not a verified pass.
