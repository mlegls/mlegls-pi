---
stage: idea
assignee: agent
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
priority: 3
blocked-by: ["after: 2026-10-14"]
---

OpenAI's Decisions API (announced 2026-09-29 at DevDay, limited preview, pricing unannounced) picks one of a fixed answer set on a Luna variant in ~150–250 ms, and accepts images. Coverage so far is press only (byteiota, The New Stack, OpenTools); no docs page was reachable 2026-09-30. Reported as returning a confidence score, not a calibrated distribution; `lib/decide.ts` callers threshold on Jev's distributions (`dist`, `p`), so that difference matters more than latency. Whether a ChatGPT/Codex subscription covers it is unknown; pi 0.99's Sign in with ChatGPT uses the subscription for the OpenAI API, which may or may not include it.

Worth trialing as a `lib/decide.ts` backend once public, first for `ab computer` (screenshots as context instead of AX/ARIA text), against recorded drives. Price and calibration decide the rest; Jev is $0.042/M input, output free. If [[projects/mlegls-pi/issues/adopt-pi-0-99-codemode-mcp-and-classifiers]] moves decide onto `ModelRuntime.classify()`, this becomes a classifier model there instead.

2026-09-30: jg's Jev bill (~$10/day on 2026-09-28–29, about 5× skim's) got its guidance disabled: the bash tool description no longer points agents at `ab jg`, and the `jevgrep` skill moved to `skills/disabled/pi/`. `ab jg` still works when asked for. Re-enable against a cheaper backend here, a local one, or our own retrieval (maintaining our own jg rather than patching the published bundle is an open option). Before re-enabling, compare jg with `rg` + read on matched tasks.
