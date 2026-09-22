---
stage: idea
assignee: agent
---

A one-line, fully shaped ticket took about 4.5 minutes through `advance.run` in the 2026-09-20 live check. The broad DeepSeek reader took roughly 213 seconds, then the candidate reader rechecked files before submitting. Context scoring hit its eight-second timeout and correctly retained the full briefing. The session assignment was usable, but preparing it can cost more latency than doing this tiny task directly.

Paths: `lib/prepare.ts`, `lib/autoread.ts`, `lib/ingress.ts`. Compare representative tickets before tuning the read scope, candidate tool access, reader model, or scoring timeout. The pipeline currently favors complete orientation and recoverable evidence; no latency gate or provider retry was added. See [session preparation](../session-preparation.md) and [[projects/mlegls-pi/issues/autoread-show-me]].
