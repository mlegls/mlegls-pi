---
stage: idea
assignee: agent
author: "session:01a0f797-f820-7245-8162-31f20d419868"
---

Drive was 21% of reconciler worker time in the [role time audit](../attachments/role-time-audit/README.md): 945 turns at 17 s each on gpt-6.1-sol:high, with about 100 reasoning tokens per turn. By what each turn did:

| kind | turns | model min |
|---|---|---|
| packet write | 260 | 118 |
| ui act | 322 | 77 |
| setup/env | 150 | 33 |
| ui observe | 134 | 28 |

The click loop is about 37% of drive's model time, so a decision-model hot loop would save little until the rest shrinks. In order:

1. Model speed. `ff33bf3` moved verify to gpt-6.1-sol:low. Remeasure with the audit script before changing anything else.
2. Log with the action. `agents/roles/drive.md` says to keep the log as you go, and drivers spend a turn per entry. Append to the log in the same codemode call as the action or observation it records.
3. Script mechanical stretches. Once the predictions are written and a stretch is known, drive it in one codemode call. Use `models.classify` only for grounding (which snapshot uid matches an intent) and check the outcome yourself. Never let the classifier judge done or stuck: those were the deleted Jev driver's failures ([[projects/mlegls-pi/issues/archive/buy-a-computer-use-driver]]). Don't script exploration; noticing friction is the driver's job.

If the remeasure still shows the UI loop dominating, the bought candidates for that slot: Stagehand v3 `act`/`observe`/`extract` with auto-caching (an explored path becomes a deterministic replay that re-infers on page change), browser-use with workflow-use, Magnitude (planner plus grounded actor), Playwright Agents (planner, generator, healer), and CLM-8B as an open Jev-class grounder.
