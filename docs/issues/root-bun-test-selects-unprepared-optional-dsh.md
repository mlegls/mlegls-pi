---
stage: idea
author: session:01a0f227-6a60-775b-8d17-d8ee02ba0643
---

During [[projects/mlegls-pi/issues/tracker-obsidian-rollout]], `ab check -- bun test` in the rollout worktree ran 350 tests across 77 files (331 pass, 3 skip, 16 fail, 16 errors). Root dependencies were present, but the optional `dsh/` package's separate setup had not been run: imports of `@deepseek-ai/dsh-session` and `@deepseek-ai/dsh-tools` failed. The headless/web combined-overlay checks also failed. This is an unprepared-suite observation, not a clean-baseline diagnosis or a plugin regression.

Owner: root test discovery/setup and `dsh/package.json`'s existing setup command. No optional package was installed just to hide this receipt. Other failures already have owners: [[projects/mlegls-pi/issues/disabled-watch-pr-tests-missing-commander]], [[projects/mlegls-pi/issues/worktree-tests-read-canonical-agent-roster]], [[projects/mlegls-pi/issues/session-terminal-regressions-fail-with-extra-shell-sessions]]. The last includes the same `sessionManager.getSessionId is not a function` callback error seen in this run.

The affected plugin build and typecheck passed after its own locked dependencies were installed; its live parity failure is separately owned by [[projects/mlegls-pi/issues/tracker-parity-compares-derived-claims-with-frontmatter-only]]. No unrelated tests or behavior were deleted.
