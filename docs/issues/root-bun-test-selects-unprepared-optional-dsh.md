---
stage: ticket
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/test-suite-hygiene]]"
blocked-by: ["[[projects/mlegls-pi/issues/bun-test-ab-selects-disabled-tool-tests-with-uninstalled-commander]]"]
author: session:01a0f227-6a60-775b-8d17-d8ee02ba0643
---

During [[projects/mlegls-pi/issues/archive/tracker-obsidian-rollout]], `ab check -- bun test` in the rollout worktree ran 350 tests across 77 files (331 pass, 3 skip, 16 fail, 16 errors). Root dependencies were present, but the optional `dsh/` package's separate setup had not been run: imports of `@deepseek-ai/dsh-session` and `@deepseek-ai/dsh-tools` failed. The headless/web combined-overlay checks also failed. This is an unprepared-suite observation, not a clean-baseline diagnosis or a plugin regression.

Owner: root test discovery/setup and `dsh/package.json`'s existing setup command. No optional package was installed just to hide this receipt. Other failures already have owners: [[projects/mlegls-pi/issues/archive/disabled-watch-pr-tests-missing-commander]], [[projects/mlegls-pi/issues/worktree-tests-read-canonical-agent-roster]], [[projects/mlegls-pi/issues/archive/session-terminal-regressions-fail-with-extra-shell-sessions]]. The last includes the same `sessionManager.getSessionId is not a function` callback error seen in this run.

The affected plugin build and typecheck passed after its own locked dependencies were installed; its live parity failure is separately owned by [[projects/mlegls-pi/issues/archive/tracker-parity-compares-derived-claims-with-frontmatter-only]]. No unrelated tests or behavior were deleted.

ticket contract, 2026-09-30: a root `bun test` either excludes the optional `dsh/` package or the root setup prepares it; decide which from how `dsh/` is meant to be used (it's optional), and say so in the setup docs.

## Result

Root Bun discovery excludes optional `dsh/**`; root setup remains unchanged.
The root and dsh setup READMEs document separate opt-in setup and package-local tests.
[Implementation checks](../attachments/root-bun-test-selects-unprepared-optional-dsh/index.md):
root run selected no dsh tests with its dependencies absent; 354 pass, 3 skip,
1 fail (the separately owned prearchive orchestration-audits report path).

First-use drive: [predictions and CLI encounter](../attachments/root-bun-test-selects-unprepared-optional-dsh/driver.md).
Root exclusion and setup documentation held with optional dependencies still absent. Driver root run: 353 pass, 3 skip, 2 fail and 1 error; failures are the existing [prearchive report](orchestration-audits-test-reads-prearchive-report-path.md) and [oversized-output flake](bash-lifecycle-oversized-output-test-flaky-under-load.md), with isolated replays recorded in the packet.
