# Did interactive context shrink with OM?

**The lowercase-author heuristic supports a modest decline in direct-interaction context.** The initial user-role-only comparison mixed in supervisor traffic and incorrectly suggested that context at interaction points had risen. With lowercase-starting messages as a proxy for the maintainer's own messages, median first-response context falls from 67k to 59k; restricting to majority-lowercase sessions gives 57k. Project/session-age matching remains essentially flat, so this is a descriptive change, not an isolated OM effect. Context is smaller, but not routinely tiny.

## Revision: distinguish author style from the `user` role

Both humans and supervising agents send user-role messages. The maintainer's lowercase writing style provides a useful additional discriminator. This pass uses **message starts**, a conservative proxy for lowercase sentence starts, not a full sentence parser:

- A lowercase-origin interaction starts with ASCII `a`–`z` after whitespace.
- A majority-lowercase session has at least three user messages starting with an ASCII letter in the study window, and over half start lowercase. Nonletter-leading messages are unclassified for the majority test.
- Keep the original session filters below; score the first assistant response after a lowercase message, optionally restricting to majority-lowercase sessions. Tool continuations are reported separately.

| Filter | Before median | OM median | Before / OM responses |
|---|---:|---:|---:|
| Lowercase message → first response | 66,551 | 58,737 | 547 / 932 |
| Also require majority-lowercase session | 66,551 | 57,474 | 547 / 882 |
| Same stricter filter, include early OM-session requests | 66,551 | 53,931 | 547 / 961 |

The strict default gives a **14% median decline**, a mean decline from 83,011 to 72,767, and a 90th-percentile decline from 169,535 to 140,938. Across all requests in majority-lowercase sessions, median context falls **113,006 → 89,499** (21%). There are 21 pre-OM roots and 77 OM roots in that subset.

The original contamination signal is large: before OM, only 26 of 573 first responses follow a non-lowercase message. During OM, 698 of 1,630 do; those 698 have a median context of **142,157**, versus **58,737** after lowercase messages. This does not prove all non-lowercase messages are supervisor-authored, but shows why treating every user-role message as the maintainer's was misleading.

The same exact-cwd/50-request-age-bin reweighting on the strict lowercase subset has 306 supported OM first responses: means **67,021 → 66,656**, effectively unchanged. Thus the corrected sample supports “my contexts have been somewhat shorter,” but cannot attribute the difference specifically to OM rather than changed tasks/models/session patterns.

These remain heuristic author labels. A supervisor can write lowercase; a human can capitalize, quote text, use Chinese or start with a command. Mixed sessions and inherited history remain. The following sections preserve the initial broad-filter results for comparison; they are not the preferred estimate of direct human interaction.
## Cohort

First retained OM ledger events appear September 2, 2026. Compare July 1–September 1 against September 2–24, stopping before Connectome. This differs from the earlier cost comparison, whose “before” cohort was already using OM.

Select likely interactive sessions: at least five user-role messages, outside worker/temp worktrees, with a conversational opening rather than a skill expansion, slash command, implementation/supervisor assignment, or explicit worker launcher. Inspect opening prompts; count successful nonzero-usage assistant requests. This is a conservative heuristic, not proof every later user-role message came from a human. Some legitimate interactive workflows are excluded.

Deduplicate copied requests by `(entry ID, timestamp)` and group related files by the initial user-message ID. Context is provider-reported `input + cacheRead + cacheWrite`, including prompt/tools—not transcript size or fresh-input tokens alone. Default OM exposure begins at the first observed ledger marker. `--include-early-om` includes the earlier requests of sessions subsequently confirmed to use OM.

The default sample has 9,856 pre-OM requests across 21 roots and 14,132 OM requests across 80 roots. Earlier data is sparse near adoption: 9,143 pre requests are from July; only 713 are August–September 1. These are retained Pi logs, not all historical Claude/Codex/other-harness activity.

## Initial broad-filter measurements (before author-style separation)

| Measure | Before OM | OM |
|---|---:|---:|
| Median request context | 113,006 | 95,602 |
| Mean request context | 125,157 | 111,896 |
| 90th percentile | 223,130 | 208,103 |
| Requests above 100k | 57.4% | 47.6% |
| Requests below 50k | 12.2% | 14.5% |
| Median of each session-root's median | 87,599 | 77,550 |
| First response after a user-role message: median | 66,404 | 85,334 |
| Median root-level first-response median | 67,038 | 59,172 |

Thus the all-request median falls **15%**, and equal-root weighting also shows an **11%** decline. But first-response request weighting rises **29%**; equal-root weighting there falls **12%**. “Typical” depends on whether a long conversation gets more weight than a short one. Neither view establishes a large, uniform contraction.

Including early OM-session requests changes its all-request median to 93,731 and first-response median to 81,058: the same qualitative result. It does not reveal a hidden population of routinely tiny contexts.

Compaction records, deduplicated by root and timestamp:

- Before: 79 compactions; median `tokensBefore` **136,489**.
- OM: 194 compactions; median `tokensBefore` **97,606**.

The roughly 29% lower compaction-point median is consistent with compacting earlier. These records do not reliably distinguish manual topic-boundary compactions from automatic triggers, so they cannot establish the motive or causal mechanism. More frequent cuts can coexist with sizeable typical context if the retained summary/tail is large or intervening work grows quickly.

## Controls and interpretation

**Project mix matters.** In `mlegls-pi`, request medians are effectively unchanged: **81,772 → 81,838**. Config-directory medians rise **85,224 → 94,627**, although the earlier sample includes the former nix-darwin directory as well as system-config.

**Approximate project/session-age matching erases the decrease.** Match exact cwd and 50-assistant-request ordinal bins, pooling ordinals >=500, then reweight pre-OM strata to OM's distribution:

- 3,582 supported OM requests: mean **83,216 → 89,301**.
- First responses only, 317 supported OM requests: mean **66,446 → 66,992**.

These are coarse controls, not causal estimates. Most OM requests lack corresponding pre-OM strata; large model and task shifts remain.

**Model overlap is weak.** Pre-OM is almost entirely GPT-5.6 Sol, plus GPT-5.5. OM includes Astra, Opus, Fable and Sonnet. The common GPT-5.6 Sol subset does not show a decline (median 116,604 before versus 172,973 during OM), but the latter contains only 537 requests/four roots and is not task-matched.

**There is no immediate sustained step down at adoption.** OM-era request medians are 140,428 on September 2–9, 78,231 on September 10–19, and 93,629 on September 20–24. Workflow/model changes and adaptation over time are plausible explanations; the logs do not isolate them.

Without author-style separation, the narrower supported statement was that compactions happened at smaller contexts and the aggregate interactive-session distribution shrank somewhat. The revised lowercase analysis above additionally supports a modest descriptive reduction at direct-interaction points. Neither analysis establishes routinely very small windows or a causal OM effect.

## Reproduce

```sh
uv run python docs/research/interactive-context-om.py
uv run python docs/research/interactive-context-om.py --include-early-om
```

Numeric request metadata and selected opening previews are written locally to `/tmp/interactive-context-om.json` and the `-early.json` variant. No transcript bodies are committed. Request ordinal/user-message counts include inherited ancestry; exposure follows chronological records rather than reconstructing every branch. Successful-request filtering excludes errors and aborts, so this is used context, not every attempted window.
