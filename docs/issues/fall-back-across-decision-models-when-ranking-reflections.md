---
stage: "ticket"
assignee: "agent"
author: "user:mlegls"
priority: 2
---
[[projects/mlegls-pi/issues/rank-omitted-reflections-with-jev]] ranks overflowing OM reflections with Jev, then falls back to newest-first on a missing credential, an error or the 4 s timeout. The maintainer, 2026-10-20: "there are many decision models now (clef, subq, openai decisions), so i'd rather fall back to another rather than heuristics", and "check if clef and subq are available via openrouter since i don't want to juggle keys". This came from the adversarial review of 2026-10-20 (concept thread thr_8ft7jvqjxa): newest-first is the ordering that lost the supervisor's role reflection before Jev ranking existed. Jev has not been seen failing; the live drive measured 1.1–1.65 s.

What was checked on 2026-10-20, with only `OPENROUTER_API_KEY` (one bool question per model through `ModelRuntime.classify` on OpenRouter's `systemone` endpoint):
- Answered: `cloudflare/clef` (893 ms), `cloudflare/clef-flash` (362 ms), `cloudflare/clef-omni` (385 ms), `openai/gpt-6-luna-decisions` (985 ms; probability exactly 0, so possibly not calibrated), `inception/mercury-decide` (337 ms), `microsoft/microsoft-decision-1` (618 ms), `~typesafe/jev-latest`. Each call cost under $0.00001.
- Not found: subq under any guessed id (`subq/subq`, `~subq/subq-latest`), and `perplexity/pplx-decider-v1.1-27b` (404, no endpoints).
- pi's `getAvailableOfType("classifier")` lists none of the answering models except Jev. It returns only `~typesafe/jev-latest`, `typesafe/jev-1.13`, mercury-decide:free, kev-4b, span-01(-lite), tev1-4b and solar-decide, although pi-ai's `openrouter.json` catalogues clef and the others. `pickClassifier` (`lib/decide.ts`) then silently falls back to any Jev when a wanted model is missing: asking `decide` for clef returned Jev's answer.

Done:
- When the first model errors, times out or gives an invalid answer, `rankReflections` tries the next model in an ordered list of OpenRouter decision models before newest-first, within one overall deadline. Choose the order from these measurements (Jev, then Clef Flash or Clef, then another family), and check that each model answers both the bool and the score questions. Newest-first remains only for when every model fails or no OpenRouter credential exists.
- One credential, `OPENROUTER_API_KEY`. Models are reached even if pi's availability list omits them, or the omission is fixed at its source if that's in reach. Asking for a specific model never silently returns a different one: `pickClassifier` either finds it or reports it missing.
- Each fallback step is recorded with its model and reason, in a log that's on by default (not only the OM debug log), so it shows whether a model ever fails in practice.
- Tests: a fake model that fails moves ranking to the next one; all failing gives newest-first. One live run on the existing fixture pool forces the first model to fail and records which model ranked, with its latency and cost. `bun test extensions/context/om` and `bunx tsc --noEmit` pass.

Out of scope: subq, until the maintainer gives its OpenRouter id; [[projects/mlegls-pi/issues/trial-openai-decisions-api-as-a-decide-backend]], which can now note that the model is on OpenRouter.
