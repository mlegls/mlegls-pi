---
stage: "done"
assignee: "agent:auto-routine"
author: "session:open-ended-terms"
priority: 3
---
Observed in the simple-compute-market open-ended-terms implementation worker for run 525-scm, 2026-11-06. Owning tool/repository: mlegls-pi supervised-worker hook-bypass guard.

The repository architecture instructs a checkout with no configured hooksPath to enable its shipped hooks with `git config --local core.hooksPath scripts/hooks`, preserving any existing hook configuration. Inspection showed no configured hooksPath and only sample hooks. The guard refused that command before execution as "Workers don't bypass git hooks (core.hooksPath)". The requested setting enables the repository's own hooks; it does not disable them. No alternate way to change Git configuration was attempted.

The worker continues with ordinary Git commits and the repository's guarded `scripts/change-workflow push`, without overriding hooks. The impact observed is inability to perform the documented hook-enablement step, not a demonstrated skipped check or corrupt commit.

The existing completed [[projects/mlegls-pi/issues/worker-hook-bypass-guard-misreads-tmux-window-name]] describes another false positive in this guard but repaired only commit flag parsing. Whether safe repository-hook enablement should be admitted needs a decision; the guard must continue refusing hook-disabling overrides.

The guard also refused the tracker create invocation when this observation was supplied through a quoted heredoc. A body file is used solely to file this report, not to execute the denied configuration operation.

## Result

done — all three stories held. Refusals now identify the existing configuration or default hook that setup would displace. Both existing guard tests passed.

```yaml
commit: 50a3a4fa
stories:
  - {story: Enable shipped hooks in a fresh checkout, outcome: held}
  - {story: Preserve an existing configured hook, outcome: held}
  - {story: Preserve an existing custom default hook, outcome: held}
evidence:
  path: docs/attachments/worker-hook-guard-refuses-enabling-repository-hooks/index.md
  visual: false
  shots: []
tests: []
filed: []
fixed:
  - Named the reason for refusing setup in both preservation cases.
  - Included ignored and untracked files when checking that the candidate hook directory is clean; replayed with an ignored post-commit hook and confirmed neither hook ran.
caveats:
  - Git shares --local configuration across linked worktrees. The guard verifies the invoking checkout; the replay covers independent repositories.
```

Evidence: [docs/attachments/worker-hook-guard-refuses-enabling-repository-hooks/index.md](../attachments/worker-hook-guard-refuses-enabling-repository-hooks/index.md)
