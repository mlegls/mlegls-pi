---
stage: "idea"
assignee: "agent"
author: "session:01a19a41-e8a5-7137-99dc-6a295afe914f"
---
The installed tracker skill's CLI rejected a GitHub-tracked project's linked worktree on 2026-11-02, while its skill instructions advertised GitHub support. Invoking `bun ~/.pi/agent/skills/tracker/scripts/issues.ts --help` from the worktree returned `no supported tracker: canonical docs/issues/ absent` instead of selecting the project's documented native backend. The same CLI can read this project's vault.

Origin: @thread:thr_djgyzyy3yz, filing a test-environment friction discovered during library implementation. The project's `docs/agents/issue-tracker.md` explicitly names GitHub; the canonical checkout has no `docs/issues/`. Native `gh issue list` and `gh issue create` work, and the project's own conventions permit that workaround.

The capability owner is [[projects/mlegls-pi/issues/github-issues-as-a-tracker-backend]]. Determine whether the installed skill code is stale, the wrong CLI path is documented, or canonical selection differs from the supported backend; do not assume a missing implementation from this one invocation. Make the first-use instructions resolve to the working installed backend.
