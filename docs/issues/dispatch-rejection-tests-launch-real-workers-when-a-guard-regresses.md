---
stage: ticket
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/test-suite-hygiene]]"
author: "session:01a0f08f-890e-7326-82fd-d04c698cf006"
---

`route-assignment.test.ts`'s "tracker launches require eligibility…" case calls the real `dispatch.dispatch` and expects each call to reject. When a guard stops rejecting, the call launches: after agent pins started keeping their model line's fallbacks, `assertAssignment` briefly accepted `agent:fill` with `zai/glm-5.3-flash:high`, and the test spawned a real `probe` worker (worktree `mlegls-pi__worktrees/probe`, pi on GLM, prompt "Must not launch") before failing. It had to be killed and retired by hand (`dispatch.retire({run: "run_test", handle: "probe", path})`; `retire("run_test/probe")` looked for the wrong path).

A rejection test shouldn't have launch as its failure mode: stub `wm.spawn` in that test (as `supervise.test.ts` mocks `route.ts`), or give dispatch a dry-run option the test uses.

ticket contract, 2026-09-30: a rejection test can't launch a real worker when its guard stops rejecting: inject a launch stub or run the guard without the launch, so a regression fails the test and leaves nothing to clean up.
