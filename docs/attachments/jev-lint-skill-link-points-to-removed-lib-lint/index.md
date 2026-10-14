# Verification: setup-project lint guidance

## Predictions before use

1. As a developer reading setup-project lint guidance, I expect no instruction to run the removed jev-lint advisory; deterministic guidance should remain usable.
2. I expect the checkout's lint references directory not to expose the removed jev-lint runner symlink.
3. I expect searching the repository's skills and agents to find no remaining invocation recommendation. Any Concept instructions discovered must be reported, not edited.

## Setup

Tested revision: `7f0aa6bfb9d56fdfeee5a049d659faef6715eb94`.
Documentation/filesystem surface in `/Users/mlegls/dev/mlegls-pi__worktrees/jev-lint-skill-link-points-to-removed-lib-lint-drive-2`; no server, authentication, seed, or browser required. Parent reports `mise run setup` completed. The implementer supplied no additional setup handoff. Entry point: `skills/enabled/all/mlegls/conventions/setup-project/references/lints.md` and its adjacent lint references directory. The file was readable, establishing readiness of this documentation surface. No implementation, diff, test or fixture was read; no repository checks were run.

## Encounters and outcomes

- **Held: guidance no longer recommends the absent advisory.** Read the complete lint guidance as a setup-project user. No Meaning paragraph or jev-lint invocation remains. TypeScript, Rust, Go, inventory and SCC instructions remain visible. Prediction 1 met; executing those unrelated checks was not part of this encounter.
- **Held: dangling reference is gone.** Checked both `test -e` and `test -L` for `skills/enabled/all/mlegls/conventions/setup-project/references/lints/jev-lint`; neither found an entry. Prediction 2 met. This includes broken symlinks, not just existing targets.
- **Held: skills/agents reference audit.** Searched `skills agents` with the grep tool for literal `jev-lint`: no matches. Prediction 3 met for the repository audit.
- **Held: dependent Concept instructions reported without editing.** Located canonical Concept at `/Users/mlegls/dev/mmon/concept`; Markdown search found `AGENTS.md:14` still instructing: `bun ~/.pi/agent/skills/setup-project/references/lints/jev-lint/run.ts . <starting-ref>`. It describes ranked advisory findings and says never gate on them. No Concept files changed. Other matches are historical evidence/issues, not new instructions.

## Frictions and expectations formed during use

- Concept's active `AGENTS.md:14` still recommends the unavailable command. Existing owner: [[projects/concept/issues/jev-lint-command-points-at-an-absent-skill-file]] (also [[projects/concept/issues/advisory-meaning-lint-entry-point-is-missing]]). Reported, not repaired, as required. This does not invalidate the scoped removal in mlegls-pi.
- The guidance still opens with “Three kinds of check” although the advisory kind is gone and the remaining discussion names honesty and size. Expectation formed while reading: the count would agree with the visible categories; not met. Filed outside the execution subtree: [[projects/mlegls-pi/issues/setup-project-lint-category-count-is-stale]]. Reviewer can judge this small wording friction alongside the scoped removal.

## Replayable checks

1. Read `skills/enabled/all/mlegls/conventions/setup-project/references/lints.md`. Accept no Meaning advisory paragraph or jev-lint invocation; deterministic configurations and SCC guidance should remain.
2. Run `test -e skills/enabled/all/mlegls/conventions/setup-project/references/lints/jev-lint` and `test -L` for the same path. Accept false for both.
3. Search `skills` and `agents` for `jev-lint`. Accept zero matches.
4. Search Concept Markdown for `jev-lint`; distinguish live instructions from historical receipts. Report the command in `AGENTS.md:14` without editing Concept.
5. Read the opening count and listed categories. Accept a count consistent with the visible guidance.

## Evidence and cleanup

Nonvisual documentation/CLI encounter; no screenshots required. No services, browser pages, containers or external resources started. No test-runner results claimed.
