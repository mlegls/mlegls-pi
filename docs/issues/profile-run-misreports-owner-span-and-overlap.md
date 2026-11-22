---
stage: "done"
assignee: "agent"
priority: 3
author: "session:thr_vrgtjptnu2"
---
# profile --run misreports owner span and double-counts owner spend

In the 2026-11-23 efficiency audit (@thread:thr_vrgtjptnu2, GPT auditor @thread:thr_986r88by8h), `bun lib/profile.ts --run SLUG` for the AP Chemistry/Biology runs returned a span of ~498,000 hours, because the selected owner session had `start=0`. Its Biology total was $71.59 against $72.39 in the deduplicated root packet. And since `--run` adds the owner's spend over the worker span, concurrent runs can't be summed: Mission $134.17 inclusive vs $98.03 worker-only, Company defects $111.43 vs $28.12.

## tasks

1. Use all of the owner thread's sessions, and take the span from the run's worker bounds.
2. Print worker-only cost and the overlapping owner cost as separate lines.
3. Done when: a fixture with a resumed/forked owner and two concurrent runs gives sane spans and worker-only totals that sum to the workers' cost (`lib/profile-project.test.ts`).

## Result

done. Both runs reported their workers’ 50-second spans. Worker-only costs summed to $11. The owner totals matched the unique in-window fixture replies: $17 for alpha and $16 for beta, with copied fork history counted once. All six affected checks passed.

```yaml
commit: 4f3844f7
stories:
  - story: Run bounds come from the workers
    outcome: held
  - story: Worker costs sum across concurrent runs without including owner spend
    outcome: held
  - story: In-window activity from every owner session is counted once, including copied fork history
    outcome: held
evidence:
  path: docs/attachments/profile-run-misreports-owner-span-and-overlap/index.md
  visual: false
  shots: []
fixed:
  - Scoped “workers + owner” to active time in the header and labeled the owner row “within worker span.”
tests:
  - lib/profile-project.test.ts
filed: []
caveats: []
```

Evidence: [docs/attachments/profile-run-misreports-owner-span-and-overlap/index.md](../attachments/profile-run-misreports-owner-span-and-overlap/index.md)
