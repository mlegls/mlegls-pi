---
stage: "idea"
assignee: "agent"
author: "session:open-ended-terms"
priority: 3
---
Observed in the simple-compute-market open-ended-terms implementation worker for run 525-scm, 2026-11-06. Owning tool/repository: mlegls-pi supervised-worker hook-bypass guard.

The repository architecture instructs a checkout with no configured hooksPath to enable its shipped hooks with `git config --local core.hooksPath scripts/hooks`, preserving any existing hook configuration. Inspection showed no configured hooksPath and only sample hooks. The guard refused that command before execution as "Workers don't bypass git hooks (core.hooksPath)". The requested setting enables the repository's own hooks; it does not disable them. No alternate way to change Git configuration was attempted.

The worker continues with ordinary Git commits and the repository's guarded `scripts/change-workflow push`, without overriding hooks. The impact observed is inability to perform the documented hook-enablement step, not a demonstrated skipped check or corrupt commit.

The existing completed [[projects/mlegls-pi/issues/worker-hook-bypass-guard-misreads-tmux-window-name]] describes another false positive in this guard but repaired only commit flag parsing. Whether safe repository-hook enablement should be admitted needs a decision; the guard must continue refusing hook-disabling overrides.

The guard also refused the tracker create invocation when this observation was supplied through a quoted heredoc. A body file is used solely to file this report, not to execute the denied configuration operation.
