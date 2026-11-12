# Independent first-use drive

Revision: 730a9df065f445266b66f2ade1c5a0b90fbe4e2b.

## Predictions before opening the product

- Two separate processes appending runs to a fresh named life should produce a single permanent order, zero-based positions, with each run contiguous.
- Repeating a source should add nothing. Reading after deleting source sessions should retain copied text and metadata.
- Fork parsing should retain ancestors' original source references, and model changes should give each message its historical provider/model.
- Six kinds should be represented; legacy optmem records should remain excluded.
- Name lookup should distinguish project-scoped and machine-wide names while sharing project identity between worktrees.
- Existing branch-facing exports should remain loadable.

## Setup

Local Bun library with SQLite, no authentication. Supplied entry point: `PI_BOARD_DIR=$(mktemp -d) bun docs/attachments/life-log-copies-and-orders-runs/first-use.ts`. The target will be a newly created caller-owned directory, overriding any inherited selector. Seed: supplied synthetic sessions and legacy record. No server or browser is needed. I will execute the supplied public-surface first-use entry without reading its implementation or fixtures.

## Actions and observations

Executed the supplied command with an explicit fresh target `/tmp/life-drive-6.KYrmma`. It exited 0. Observed successful SQLite/library use established readiness; there is no listening service. Removed the owned target after the command, including its database. No inherited selector was used.

| Claim / prediction | Outcome and observed state |
| --- | --- |
| Concurrent runs have contiguous permanent positions | Met: process one reported additions 0–6, process two 7–13; final read listed exactly positions 0–15 after the fork. |
| Repeating a source adds nothing | Met: each process reported `repeat: 0`. |
| Copies survive source removal | Met: final output reported `sourceFilesExist: false` and printed all 16 copied messages with text, dates, model, place and source. No legacy optmem body appeared. |
| Fork preserves ancestors without duplicating them | Met: fork chain included its parent; seven inherited references used the parent session id. Only two new fork messages were added at 14–15. |
| Six kinds and historical models | Met: each original run read user, agent, tool, echo, self, work, agent. Initial user used demo/first, assistant/tool/echo demo/reply, later self/work/agent demo/next. Fork user used demo/next, assistant demo/fork-model. |
| Project versus machine identity | Met through supplied first-use entry: project output was `/home/mlegls/dev/mlegls-pi/.git:first-use`, machine `/first-use`. The documented entry exercises main/worktree identity and outside-git lookup. |
| Intermediate consumers load | Met: separately ran `bun -e 'await import("./extensions/context/life/build.ts"); await import("./extensions/context/life/index.ts"); console.log("Intermediate consumers imported")'`; exit 0, printed the confirmation. |

The output retained the literal sibling/worker message wrappers and the tool-call text `read {"path":"x"}`. The same assistant entry had separate #0 agent and #1 tool source references. No rendered UI was involved.

## Frictions

None encountered in the supplied library journey. The final script suggests inspecting its target; this drive deliberately cleaned that temporary target after collecting the output.

## Replayable checks

1. Run the reproduction entry against a new PI_BOARD_DIR; accept only disjoint contiguous seven-position ranges and zero repeat additions from both appenders.
2. In its fork output, compare inherited refs with the original run: accept original session ids and only two fork additions.
3. In final output require sourceFilesExist false, all 16 ordered records, all six kinds, the historical model transitions above and no legacy body.
4. Run the separate import command above: accept successful imports without requiring extension activation or a model.

## Limits and cleanup

This is the ticket's synthetic, public-library first use, not live session attachment/context assembly (owned by the later ticket). No implementation, tests or fixtures were read; no test suites were run. No server, browser, container or persistent temporary target remains. The single concurrent schedule observed here does not constitute a contention stress audit.

