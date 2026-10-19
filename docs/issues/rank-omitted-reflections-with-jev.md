---
stage: "done"
author: "session:thr_s276cmsmq4"
---
condense-reflections-to-their-render-share (0e505b2d) shipped the reflection backstop with `PRESERVATION_FLOOR` in `extensions/context/om/session-ledger/render-summary.ts`: five regexes over reflection text (role, preferences/permissions, must/never/rules, blocked/pending, decided/decision). Any match is protected, and the rest go newest-first. The maintainer wants no ad hoc string matching here: Jev is at least as good, and the cost is negligible because omission only fires at compaction when reflections exceed their render share.

Done:
- `PRESERVATION_FLOOR` and `preserveReflection` are deleted. When reflections exceed their render share, the compaction hook (already async) ranks them with Jev before calling the renderer, and the renderer takes the resulting order (or a priority set plus order) as input. Ask Jev for reflections that state the session's role, user preferences or standing permissions, constraints, open blockers, or decisions still in force (the condenser prompt's preservation floor), first. Rank the rest by relevance to the session's current work, using the newest observations as context.
- Jev is reached through TypeSafe or OpenRouter; both keys are in the maintainer's default environment (`OPENROUTER_API_KEY` is exported in sessions). Read the typesafe-ai skill and use a cheap default model. If no credential is available or Jev errors or times out (a few seconds), fall back to newest-first, and log it to the OM debug log. No regex fallback.
- Jev does not run when reflections fit.
- Tests: the renderer honours a supplied order. A scripted or fake Jev ranks the role and constraint reflections ahead of newer ordinary ones. The no-credential path falls back to newest-first. One live Jev call on a fixture pool keeps the role reflection; record its latency and cost in the evidence. `bun test extensions/context/om` and `bunx tsc --noEmit` pass.

## Result

done

Review found no defects in the diff, so I made no repairs and added no commits. `bun test extensions/context/om` gives 8 pass, 0 fail, and `bunx tsc --noEmit` is clean. `PRESERVATION_FLOOR` and `preserveReflection` are gone.

I read the diff against the ticket and the driver's packet. Jev ranking runs only in the compaction hook's async `prepare` step, and only when reflections overflow their render share. It falls back to newest-first, with a `reflection_rank.fallback` debug event, on a missing credential, an error or the 4 s timeout, and there is no regex fallback. The renderer takes `reflectionOrder` and still displays reflections chronologically. Reflection ids missing from the order sort after the ranked ones, newest-first.

The driver filed no frictions, so there was nothing to triage in the tracker.

```yaml
commit: 26547d6a
stories:
  - story: Overflow preserves ranked role and constraint
    outcome: held
  - story: Fitting reflections bypass Jev
    outcome: held
  - story: Missing credentials, errors and timeout fall back newest-first with debug events
    outcome: held
  - story: Live Jev preserves role
    outcome: held
evidence:
  path: docs/attachments/rank-omitted-reflections-with-jev/index.md
  visual: false
  shots: []
tests:
  - extensions/context/om/hooks/rank-reflections.test.ts
  - extensions/context/om/session-ledger/render-summary.test.ts
filed: []
caveats:
  - "cost: Jev ranking adds one network call at overflowing compaction only, capped at 4 s. Live measure: 1.1–1.65 s, about $0.00017 for 14 reflections, 4,043 input and 516 output tokens (OpenRouter ~typesafe/jev-latest). It adds no cost when reflections fit."
  - "render-summary.test.ts: I did not change its assertions. The driver changed the omission test to honour a supplied order, which is the intended contract change."
  - "The live Jev run is from the driver's packet; I did not repeat it."
```

Evidence: [docs/attachments/rank-omitted-reflections-with-jev/index.md](docs/attachments/rank-omitted-reflections-with-jev/index.md)
