---
stage: idea
author: session:2026-09-26T09-29-46-063Z_01a0dd0c-9b4f-7795-aad1-0299963801cf
---

September 26 Concept verifiers report that `ab computer` cannot resolve Playwright from the monorepo root but works from `packages/web`. Several first attempts also omit required `--until`; `agents/verify.md` advertises only `ab computer "INTENT"`. Retries stall on sign-in or end-state verification; some workers switch to chrome-devtools-axi, others end blocked.

These are distinct observations, not proof of one driver bug. Review the documented first-use route, dependency ownership and help/example consistency before changing resolution or adding dependencies. The previous browser adapter delivery does not establish this root-invocation journey. Sources: research review B.

[Session evidence and dispositions](../research/session-friction-review-2026-09-26.md).
