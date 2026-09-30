---
stage: done
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/archive/test-suite-hygiene]]"
author: session:01a0f08f-a014-7757-a5c0-dfe1d53421d4
---

`bun run test:lib` in a mlegls-pi worktree failed two route-assignment checks. `lib/agents.ts` defaults `PI_AGENTS_DIR` to `~/.pi/agent/agents`, which here symlinks to the canonical checkout rather than the tested worktree. The canonical roster selects `openai-codex/gpt-6.1-sol:max`, absent from the worktree's active routing catalog, so the checks reported an unknown assigned model/effort and an ineligible preference.

Workaround: `PI_AGENTS_DIR="$PWD/agents"` made both checks pass; `PI_AGENTS_DIR="$PWD/agents" bun test lib/route-assignment.test.ts` passed all six tests. A full library run with that override and `env -u PI_WM_PARENT_SESSION` still had a terminal-test failure, tracked in [[projects/mlegls-pi/issues/archive/session-terminal-regressions-fail-with-extra-shell-sessions]]. This is one worktree encounter, not a clean-baseline comparison.

Possible improvement: project regressions can select the checkout's roster explicitly; whether `lib/agents.ts` should change its runtime default is a separate decision.

ticket contract, 2026-09-30: tests that validate the agent roster against the routing catalog read the roster from the checkout under test, not `~/.pi/agent/agents` (which points at the canonical checkout). Also covers the duplicate [[projects/mlegls-pi/issues/archive/route-assignment-tests-read-host-roster-against-project-catalog]].

## Result

Driver and review evidence: [checkout-owned roster validation](../attachments/worktree-tests-read-canonical-agent-roster/index.md). `bunfig.toml` preloads `lib/test-preload.ts`, which defaults `PI_AGENTS_DIR` to the checkout's `agents/` for `bun test`; with a stale host roster the route-assignment file went from 2 failures to 9 passes, and `bun test lib` passes (197, 0 fail).

## Verification evidence

[Encounter and evidence](../attachments/worktree-tests-read-canonical-agent-roster/index.md).
