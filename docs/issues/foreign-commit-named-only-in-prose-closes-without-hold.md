---
stage: "done"
assignee: "agent:auto-routine"
priority: 2
author: "session:01a1cdb0-4d22-72bc-8778-94e6b358a046"
---
supervision-plugin-load-times-out-after-daemon-restart closed (mlegls-pi eec284f4) while its runtime fix, bb-plugins `c9c60ff` on branch `supervision-restart-load`, was still outside `/home/mlegls/dev/bb-plugins` main. The review's Result says so in prose: "**Landing requires two repositories:** … the runtime fix is `bb-plugins` commit `c9c60ff` on `supervision-restart-load`, still outside `bb-plugins/main`." Its handoff evidently did not declare the commit as `commit: [{checkout, commits}]`, so the foreign-commit hold from [[projects/mlegls-pi/issues/verify-foreign-repository-commits-are-installed-before-closing]] never engaged. The supervisor found it by reading the Result and landed it at bb-plugins 8d98724.

The repair goes wherever the declaration is missed: the implementer handoff that first produced the commit, the review that carried it forward, or a completion-time check of commits a run's workers created in other repositories' worktrees (here a worktree of ~/dev/bb-plugins under the implementer's `.wm/`). That last option doesn't depend on any report.

## Done when

- A run whose worker committed in a worktree of another loaded repository holds at completion until that commit is in the repository's checkout, whether or not any handoff declared it.


## Result

done — Both replays held the issue open until the loaded checkout contained the foreign commit, including when the worker removed its worktree before reporting. All six affected checks passed.

```yaml
commit: 48666c49
stories:
  - story: An undeclared foreign worker commit holds completion until the loaded checkout contains it.
    outcome: held
fixed:
  - Each active tick records uninstalled foreign worktree HEADs by worker. Completion uses those receipts after cleanup without scanning surviving branches.
evidence:
  path: docs/attachments/foreign-commit-named-only-in-prose-closes-without-hold/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - A HEAD created and removed between observations can be missed. Once observed, it remains required even if amended.
  - One active-worker scan took 895 ms on this host. Workers share repository discovery within a tick.
```

Evidence: [docs/attachments/foreign-commit-named-only-in-prose-closes-without-hold/index.md](../attachments/foreign-commit-named-only-in-prose-closes-without-hold/index.md)
