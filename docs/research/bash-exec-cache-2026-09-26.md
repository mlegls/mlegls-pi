# Bash/exec follow-up: where cache reuse went — 2026-09-26

Keep bash for now. The largest identified cache regression belongs to Connectome's context rewrites, not the shell tool. Returning to exec while keeping the same memory integration would retain that mechanism. The earlier model split is not sufficient evidence for routing Luna/Sol back to exec.

This follows the [token comparison](bash-vs-exec-2026-09-26.md), using the same frozen cohort and cutoff. No production behavior changed.

## Consecutive requests locate the loss

Joined all 62,686 retained assistant requests to their preceding transcript request. For the steady-state comparison, require the same model/provider/API, linear parentage, successful current and previous requests, a 0–60 second gap, and no recorded Pi compaction or system-message change. This removes startup, navigation, model switching, long idle periods and error retries as explanations.

14,858 requests join to per-session Connectome compile traces. A join requires the most recent compile within 30 seconds before the assistant timestamp, with 100 ms tolerance. Named/legacy lives are not joined: **unjoined does not mean Connectome off**. Fold events come from the library's adjacent `plan-vs-actual` log (`moves > 0`), not just an inferred drop in context length.

Diagnostic prefix deficit:

```
max(0, min(previous input total, current input total) - current cacheRead)
```

This is a size-based proxy, not a byte-level longest-common-prefix measurement. It excludes growth beyond the previous input length but can include provider block granularity, previously generated reasoning, or new material replacing old material. Large deficits coinciding with logged folds are the useful signal.

| Model | Exec steady requests | Prefix deficit/request | Bash with Connectome, no fold | Prefix deficit/request | Bash fold requests | Prefix deficit/fold |
|---|---:|---:|---:|---:|---:|---:|
| Opus 5.5 | 8,181 | 31 | 2,014 | 472 | 19 | 227,798 |
| GLM 5.3 Flash | 3,617 | 322 | 2,599 | 534 | 34 | 101,455 |
| GPT-6 Luna | 7,002 | 746 | 7,612 | 814 | 223 | 130,095 |
| GPT-6 Sol | 10,124 | 372 | 1,439 | 337 | 22 | 103,815 |

Every one of these 298 joined fold requests loses more than 8,192 tokens of potential prefix reuse. They are only 1.6% of all steady bash requests but account for **69% of the measured prefix deficit** in that entire steady bash sample, including unjoined requests. Within joined, plan-logged Connectome requests, folds account for 50–60% of fresh input/write tokens and 71–82% of prefix deficit, depending on model.

This is not the shell constantly invalidating its prompt: the same bash sessions regain cache reuse immediately after a fold. Remaining losses outside joins are not all explained; unjoined Opus requests in particular still contain substantial deficits.

### One observed sequence

Concept Luna session `01a0d6d3-5b3b-706f-b363-231ea2e3546b`, September 25 UTC:

| Request | Input total | Cache read | Fresh input | Logged fold moves |
|---|---:|---:|---:|---:|
| 04:43:32, `231d0d5d` | 107,047 | 105,984 | 1,063 | 0 |
| 04:43:44, `905727f9` | 95,616 | 4,608 | 91,008 | 40 |
| 04:43:58, `4fd7ff7d` | 96,420 | 94,720 | 1,700 | 0 |

A roughly 11k reduction purchases a 91k fresh read. At this request's recorded 10:1 input/cache-read price ratio, the extra cost of rereading 91,008 tokens rather than reading them cached is about $0.00819. Keeping an 11,431-token reduction saves about $0.000114 per subsequent all-cached request: roughly 72 such requests to amortize the reread alone, ignoring memory generation and other changes. The session actually folds 42 times in 509 requests, with a median ten requests between folds. This is an illustrative local calculation, not a complete counterfactual replay: later reductions can accumulate and history cannot grow indefinitely.

## There is a second bill

Connectome memory writes are explicitly outside Pi session totals (`extensions/connectome/index.ts`, `membraneFor`). The same cutoff contains **3,155 logged memory calls across 130 cohort sessions**, with 4.98M output tokens and $90.18 recorded cost. Main bash session cost was $462.21, so these known additional calls alone add 19.5% to that total. Named/legacy lives are excluded from this join; it is not a complete memory bill.

| Model | Memory calls | Memory cost | Added cost relative to main calls in those sessions | Memory input cache-read share |
|---|---:|---:|---:|---:|
| Opus 5.5 | 384 | $69.54 | +48.7% | 18.9% |
| GLM 5.3 Flash | 612 | $2.16 | +22.0% | 17.5% |
| GPT-6 Luna | 1,859 | $3.79 | +24.7% | 28.7% |
| GPT-6 Sol | 282 | $9.20 | +28.2% | 28.6% |

The remaining 18 calls are Astra. These figures include failed memory calls with reported usage. They are observed extra spending, not the incremental cost versus exec's old compaction: the earlier audit also did not account for separate Pi compaction calls. Memory quality and task continuity may justify some spending; neither was measured here.

## Concrete integration gaps

Connectome arrived September 25, after the exec cohort. The adapter selects `foldingStrategy: "kv-stable"`, but the policy's name hides important defaults and transport requirements.

1. **The churn bound is unset.** `@animalabs/context-manager` 0.10.1 already owns the control: `kvStableReachTokens` bounds normal per-compile perturbation, and `compressionSlackRatio` supplies hysteresis. Its documented default reach is the entire hard budget—explicitly nonbinding. Our constructor supplies neither, leaving reach unrestricted and slack at 0.1. Setting the strategy name alone does not establish a small cache-churn budget. Infeasible/quality-gap overrides can still exceed a configured bound; a tight bound is not a universal cure.
2. **Cache markers are discarded at the Pi bridge.** The library emits `cacheBreakpoint` on compiled/memory messages, including a marker at the surviving prefix. `toPiMessages` ignores that field. A direct pure-function probe with a marked user message returns an unmarked Pi message. The installed Pi Anthropic adapter adds its own endpoint marker rather than consuming the library's internal boundaries. `membraneFor` also does not forward the library's `cacheTtl`. This is a verified transport gap, especially relevant to Anthropic; it does not by itself explain automatic-cache OpenAI losses.
3. **The estimator has no provider feedback.** The library exposes `AutobiographicalStrategy.reportRealInputTokens`, but the adapter never invokes it. The library's estimated window and the provider's actual window are not calibrated together. This is a missing feedback path, not yet a measured attribution of the regression to estimation error.
4. **Memory generation is speculative and uses the session model/thinking level.** Adaptive resolution defaults speculative production on. The library already has production controls; a new local scheduler is not the first solution. Compare their cost and quality before changing the model used for memories.

The library also ships `kv-unified`, with explicit policy and cache/presentation receipts. It is not a drop-in magic switch: its configuration intentionally has no live defaults. Prefer completing the current integration and exercising existing controls over implementing another context manager.

Relevant sources: `extensions/connectome/index.ts` (`activate`, `toPiMessages`, `membraneFor`, the `context` handler); dependency `src/types/strategy.ts` (`kvStableReachTokens`, `compressionSlackRatio`), `src/context-manager.ts` (emitted breakpoints), and `src/strategies/autobiographical.ts` (marker placement, calibration, speculative production). Installed Pi `pi-ai/dist/api/anthropic-messages.js` owns final wire cache controls.

## What this says about tool mode

- **Return to exec:** not supported as a remedy for the identified cache loss. Exec and bash both pass through the same Connectome context hook.
- **Fix bash:** shorter argument payloads remain a real local advantage. Larger feedback/result text remains worth examining, but it is not the cause of the fold-aligned cache resets.
- **Split by model:** not yet. The earlier context/output differences do persist in short worktree prefixes before most folding, so Connectome does not explain every difference. But those are still different assignments and prompts, not a demonstrated model × tool interaction. Even nominally identical launcher stances sometimes delivered auditing work under an `implement` preamble.

The next change should target memory economics: preserve provider-supported cache boundaries/TTL, wire actual usage feedback, and trial an explicit perturbation budget plus wider hysteresis using the library's existing controls. Measure fold frequency, recached tokens, memory-call cost, retained context and task outcomes together. Do not claim that preserving markers eliminates necessary refolding.

Then compare exec/bash on the same bounded assignments and model with memory policy held fixed. Start with Luna, where the apparent regression is large, and Opus as the opposite-sign case; use fresh worktrees at the same commit, identical prompts/acceptance checks, and counterbalanced mode order. Count total main + memory usage through accepted completion, elapsed time and repair turns. Only introduce model-specific routing if the interaction repeats. No global tool-mode or memory-setting switch was made during this audit.

## Reproduce

After the original extraction:

```sh
uv run python docs/research/bash-exec-cache.py
uv run python docs/research/bash-exec-cache-summary.py
```

Metadata and aggregates remain under `/tmp/bash-exec-tokens/`; no transcript bodies are committed.
