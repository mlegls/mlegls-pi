# CLI removal encounter

Revision: `160c9f3d4d9af608ded39dc7db981447919fb531`.

## Predictions before checkout-owned use

- Removed Threads app and tree sidebar: checkout CLI help should no longer advertise tree GUI commands; `tree` should reject rather than launch a GUI.
- Preserved runtime: `ab thread` should expose its commands and `ab thread ls` should list threads without a sidebar.
- User documentation: README and dispatch guidance should no longer direct users to Threads or the sidebar.
- Structural deletion, fixture actions and compilation/test acceptance belong to implementation review; I will not inspect source or run repository checks.

## Setup

CLI-only deletion journey; no GUI deployment, authentication or seed required. Owned target is this worktree's `./bin/ab`, not the globally installed `ab`. Provided mise setup log reports both frozen dependency installs completed. No server required.

Before target selection I accidentally ran global `ab --help`; it advertised old tree commands. This is not evidence about this checkout. All ensuing commands use explicit `./bin/ab`.

## Observations and outcomes

- **Held — removed GUI entry point:** `./bin/ab --help` prints only `usage: ab thread ...`; `./bin/ab tree` prints the same usage and exits 2. No GUI opens. Existence checks find `apps/threads` absent.
- **Held — retained thread listing:** `./bin/ab thread --help` advertises ls/new/fork/attach/send/history/seen/archive/abandon/merge/to-bb. `./bin/ab thread ls` exits 0 and shows registry rows, including this exact worktree. The registry is shared host state; no threads were modified or seeded. Raw rows are intentionally not committed.
- **Held — user-facing documentation:** README no longer lists lib/tree; dispatch guidance describes bb desktop/web/mobile and uses `ab thread ls`, without sidebar/Threads instructions. The two retired work-in-threads documents are absent.
- **Not independently observed — implementation gates:** retained graph imports, deleted internal modules/tests and fixture actions, dangling-link checker and typecheck/test gates need reviewer evidence. Those are not a first-user surface and are not waived by this encounter.

## Expectations

All three surface predictions met. The additional expectation that the listing would identify this worker also met. No expectation about mutating thread commands was formed or tested: spawning/merging was outside this deletion journey.

## Replayable checks

1. From this checkout run `./bin/ab --help` and `./bin/ab tree`: accept thread-only usage, rejection exit 2 for tree, and no GUI launch.
2. Run `./bin/ab thread --help`, then `./bin/ab thread ls`: accept documented thread commands and a successful listing containing the current worker's cwd.
3. Read README and docs/dispatch.md: accept no instructions to launch Threads/sidebar; check the retired app and two guide/story paths are absent.

## Frictions and cleanup

No unresolved product friction encountered. The initially selected global command was the wrong deployment and its output was discarded, not treated as a checkout regression. No servers, windows, browser pages or other external resources were started. Nonvisual CLI journey; no screenshots.


## Review

- Deleted modules/tests and moved `lib/graph.ts`: remaining importers (profile, context, board host, session-meta) resolve; `bun run typecheck` passes; `bun test`: 225 pass, 2 skip, 0 fail. The graph tests that lived in the deleted `lib/tree/tree.test.ts` went with it, as the ticket directs.
- Repaired: `docs/attachments/worker-admission/fixture.ts` no longer parsed (the `else throw` branch was cut with the tree actions, leaving an unclosed block, and typecheck does not cover it). Restored the unknown-action error and removed the `tree`/`tree-list` lines from that fixture's index; `bun build` of the fixture now succeeds.
- Dangling links: the vault (main checkout) still holds `guide/work-in-threads.md` and `stories/work-in-threads.md` until this branch merges; the only live reference, `issues/forked-thread-retains-parent-board-subscriptions.md`, now points at the archived decision issue (tracker commit bc5a083e). Remaining references are in archived issues and attachments, left as is.
- The unrelated `cua-safari-background-type-changes-frontmost` idea arrived through the merge; it names an owner and an open investigation, so left as filed.
