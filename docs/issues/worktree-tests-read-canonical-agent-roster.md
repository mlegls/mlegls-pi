---
stage: ticket
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/test-suite-hygiene]]"
author: session:01a0f08f-a014-7757-a5c0-dfe1d53421d4
---

`bun run test:lib` in a mlegls-pi worktree failed two route-assignment checks. `lib/agents.ts` defaults `PI_AGENTS_DIR` to `~/.pi/agent/agents`, which here symlinks to the canonical checkout rather than the tested worktree. The canonical roster selects `openai-codex/gpt-6.1-sol:max`, absent from the worktree's active routing catalog, so the checks reported an unknown assigned model/effort and an ineligible preference.

Workaround: `PI_AGENTS_DIR="$PWD/agents"` made both checks pass; `PI_AGENTS_DIR="$PWD/agents" bun test lib/route-assignment.test.ts` passed all six tests. A full library run with that override and `env -u PI_WM_PARENT_SESSION` still had a terminal-test failure, tracked in [[projects/mlegls-pi/issues/archive/session-terminal-regressions-fail-with-extra-shell-sessions]]. This is one worktree encounter, not a clean-baseline comparison.

Possible improvement: project regressions can select the checkout's roster explicitly; whether `lib/agents.ts` should change its runtime default is a separate decision.

ticket contract, 2026-09-30: tests that validate the agent roster against the routing catalog read the roster from the checkout under test, not `~/.pi/agent/agents` (which points at the canonical checkout). Also covers the duplicate [[projects/mlegls-pi/issues/archive/route-assignment-tests-read-host-roster-against-project-catalog]].

## Result

Driver evidence: [checkout-owned roster validation](../attachments/worktree-tests-read-canonical-agent-roster/index.md). Default entry point passed 9/9; the roster/catalog validator passed with 38 assertions even when `PI_AGENTS_DIR` selected a nonexistent host roster. Runtime-routing tests elsewhere in the same file still depend on that host selector.
