---
stage: "idea"
assignee: "agent"
author: "session:01a1b1b0-6881-7304-a2aa-26e6ac8a0d8c"
---
During resize-multiplier-c's final implementation slice in simple-compute-market, the worker instructions required unresolved tooling friction to be filed through the tracker skill. The project's AGENTS.md instead records deferred work in OpenSpec and explicitly says not to use GitHub Issues for repository work.

`bun ~/.pi/agent/skills/tracker/scripts/issues.ts outline` from the linked SCM worktree returned `no supported tracker: canonical docs/issues/ absent`. The skill documents vault/GitHub/GitLab adapters but no OpenSpec convention. No code or issue was written in the SCM tracker. Workaround: keep the execution checkpoint in the active OpenSpec tasks and file this tooling observation in the worker-tooling repository through its working vault adapter.

The originating story is completing the agreed-shape negotiation slice while recording unavailable deployed-e2e setup honestly. No product behavior is blocked by tracker access itself. Proposed improvement, not an observed requirement: make the worker friction instruction defer to a project's declared planning convention, or provide an adapter for that convention.
