---
stage: "done"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
---
OM's Reflections section in the compaction summary only grows, and a continued session lost all of it.

Measured in the concept supervisor's session (`~/.bb/pi-bridge-sessions/thr_vetzcc74ex.jsonl`, 10-03 to 10-19, 18 compactions): Reflections went from 0 to 627 lines (214k chars, ~54k tokens), carried on every call; `observationsPoolMaxTokens` (20k, `extensions/context/om/hooks/compaction-hook.ts`) bounds only Observations, which stayed ~40k chars. Context p50 was 186k, p90 380k, over 6,126 calls ($1,120 total).

At the 2026-10-19T01:48 compaction, right after the session continued from a rewound file (`parentSession: thr_vetzcc74ex_rewind_….jsonl`), the summary had no Reflections at all: the role designation ("persistent top-level tend supervisor") and the "red verify:main blocks landings" rule were gone.

Wanted: reflections held to a budget (consolidated or dropped like observations), and carried across a bb rewind/continuation.


## Amendment (2026-10-19, maintainer)

The condenser and the rewind fix landed (8d009f62, 964b60ef). Two changes before closing:

- **Port upstream's render budget.** Take `renderSummaryWithBudget` from elpapi42/pi-observational-memory (`src/session-ledger/render-summary.ts`, `resolveCompactionSummaryMaxTokens` in `src/config.ts`, at 022da5e) with its defaults. The summary budget is `compactionSummaryMaxTokens`, else one eighth of the session model's context window, else 8,000. Observations are reserved at least half, newest first, and reflections get the remainder. Omitted records are named in a trailing line, and they stay recallable.
- **The condenser becomes a storage safety bound, not the main one.** Defaults: `reflector.maxTokens` 60k, `reflector.targetTokens` 40k. It was lossy (85%) at 12k/8k.

Done also when:
- A compaction on a session with more reflections than the summary budget renders within budget, with the omission line.
- `bun test extensions/context/om` and `bunx tsc --noEmit` pass.
- The concept supervisor's next compaction after reload carries its role reflection.

## Result

done

Review found nothing to repair. The change matches the amendment: the summary budget resolves from the explicit setting, then one eighth of the window, then 8,000. Observations are reserved half and kept newest first, reflections get the remainder, and the omission line names what was dropped. Condenser defaults are 60k/40k.

I ran `bun test extensions/context/om extensions/context/mechanism.test.ts` (7 pass) and `bunx tsc --noEmit` (passes). The driver couldn't observe allocation, so I checked `renderSummaryWithBudget` directly. With 100 reflections and 100 observations at a 2,000-token budget, it kept the newest 16 reflections and 14 observations in 1,914 tokens and omitted 84 and 86. With only 2 observations, reflections took the freed space (30 reflections, 1,932 tokens).

The workers filed no tracker friction, so there was nothing to triage. I appended my review to `docs/attachments/om-reflections-grow-without-a-budget/drive.md` and committed it as `2aaca5a1`.

```yaml
commit: 2aaca5a1
stories:
  - story: Oversized memory compacts within budget with recallable omissions
    outcome: held
  - story: Explicit budget and unknown-window fallback
    outcome: held
  - story: Continuation replay carries supervisor role
    outcome: held
  - story: Newest-first selection and observation reservation
    outcome: held
evidence:
  path: docs/attachments/om-reflections-grow-without-a-budget/index.md
  visual: false
  shots: []
tests:
  - extensions/context/om/config.test.ts
caveats:
  - "Live acceptance is still open: the concept supervisor's next real compaction after this lands and `thr_vetzcc74ex` reloads must carry the role reflection. It can't be observed before integration, so I left it out of the stories list. The reconciler should hold the ticket open for it."
  - "Under a tight budget the role reflection can be omitted because selection is newest-first with no pinning. In the replay it was dropped at `--budget 8000` and kept at the default 1M-window budget of 125,000 tokens."
  - "The `config.test.ts` assertions were extended for `compactionSummaryMaxTokens`. No other kept test assertion changed."
  - "Token counts use the character/4 estimate ported from upstream, not a model tokenizer."
```

Evidence: [docs/attachments/om-reflections-grow-without-a-budget/index.md](docs/attachments/om-reflections-grow-without-a-budget/index.md)
