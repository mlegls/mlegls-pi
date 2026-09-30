---
stage: done
assignee: agent
author: session:01a0f08f-913a-7450-a25c-084de0213c0f
---

During [[projects/mlegls-pi/issues/archive/ab-check-loses-waiter-after-daemon-timeout]] implementation, `ab check -- bun test ab lib/resources` selected disabled skills too (Bun treats bare arguments as substring filters). It reported 93 passing tests and one load error: `Cannot find package 'commander'` from `skills/disabled/all/pstack/poteto-mode/scripts/watch-pr/cli.ts`.

Owner: mlegls-pi test discovery/setup. The worktree's configured setup had already installed its dependencies; no optional disabled-skill dependencies were added. Workaround for the affected suite: use explicit directories, `ab check -- bun test ./ab ./lib/resources`.

Consider whether root test discovery should exclude optional disabled skills or whether their dependency setup should be documented. This is a setup/discovery observation, not a failure in the check waiter change.

disposition, 2026-09-30: duplicate of [[projects/mlegls-pi/issues/archive/bun-test-ab-selects-disabled-tool-tests-with-uninstalled-commander]].
