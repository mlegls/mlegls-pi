---
stage: idea
author: "session:01a0f08f-890e-7326-82fd-d04c698cf006"
---

During [[projects/mlegls-pi/issues/supervise-job-dies-on-a-decision-api-503-at-child-launch]], `ab check -- bun-axi test lib` failed two `route-assignment.test.ts` cases. `lib/agents.ts` reads the host roster from `~/.pi/agent/agents` when `PI_AGENTS_DIR` is unset, while the tests validate those preferences against this checkout’s `routing.md`. The host roster selects `openai-codex/gpt-6.1-sol:max`, which the checkout catalog does not contain (`gpt-6-sol` is the listed model), causing `Unknown assigned model or effort` and `toContainEqual` failures.

Rerunning `lib/route-assignment.test.ts` with `PI_AGENTS_DIR="$PWD/agents"` passed. This is test-environment configuration, not an observed live routing failure.

Should the project routing regressions pin `PI_AGENTS_DIR` to the checkout roster while leaving runtime host defaults unchanged?
