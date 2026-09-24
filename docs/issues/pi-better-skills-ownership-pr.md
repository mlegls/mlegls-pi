---
stage: ticket
assignee: human
author: session:2026-09-24T07-18-35-016Z_01a0d247-c907-7064-88fb-f3f745a1ab42
---

Get explicit tool-result skill ownership accepted upstream in edxeth/pi-better-skills ([PR #4](https://github.com/edxeth/pi-better-skills/pull/4)), so exec no longer depends on the pinned `mlegls/pi-better-skills` fork at `a87cfcc`. See the exec-ownership entry in [[projects/mlegls-pi/frictions]]; the fork switch-back is [[projects/mlegls-pi/issues/pi-better-skills-return-upstream]].

State on 2026-09-24: the reproduction posted 2026-09-21 was answered by the maintainer the same day: "the added prompt tells everyone using `exec` to call `loadSkill(path)`, but that assumes your setup, hence it's highly opinionated with a custom tool requirement hardcoded in this extension. My Pi doesn't have an `exec` tool." The PR now conflicts with upstream (v1.3.5 moved sources into `src/` and refactored skill delivery for their issue #9).

decisions:
- 2026-09-24: upstream gets only the code patch: the marker check in the `tool_result` handler and a test. The system-prompt and README changes are dropped; exec's own tool guidance (`extensions/exec/modules.ts`) already says raw SKILL.md reads need `loadSkill(path)`. Rebased onto v1.3.6 as `explicit-skill-ownership-v2`; upstream master already fails 10 pi-docs tests locally, the same set as before the change.

Remaining: force-push to the PR branch and reply to the maintainer, both after human review of the reply.
