# Life log: implementation first use

Independent verification at 730a9df0: [drive-6 encounter](drive-6.md). All first-use claims held; library-only, no screenshots.

Tested implementation: 0a729449, based on 99f57444. Library-only, local SQLite; no account or credentials.

Two gated Bun processes appended seven-message runs at positions 0–6 and 7–13; both repeats added nothing. A pi fork retained the seven inherited source refs and appended only its two new messages. The log still read all 16 messages after the source session directory was removed, including from a new process.

## Reproduce

From the checkout, run:

`PI_BOARD_DIR=$(mktemp -d) bun docs/attachments/life-log-copies-and-orders-runs/first-use.ts`

[first-use.ts](first-use.ts) creates synthetic pi session files and a schema `optmem` record, releases two appenders together, forks the first session, removes the source directory, and prints the copied log. The caller owns the fresh `PI_BOARD_DIR`; the script prints its path and leaves its database for inspection. Nothing calls a model or starts a server.

## Observed

| Claim | Action and result |
| --- | --- |
| Whole runs share a permanent order | Process `two`, source session `01a1cd9c-296b-7230-8be0-1275fdea341c`, committed positions 0–6; process `one`, source session `01a1cd9c-296b-7230-8be0-12733a709a38`, committed 7–13. Each process repeated its input and received zero new messages. |
| Forks retain inherited sources | Fork `01a1cd9c-2a8a-7230-8be0-12760546a960` had the first session in `sessionChain`. Its first seven inputs retained `entry:01a1cd9c-296b-7230-8be0-12733a709a38/<entry>#<k>`; append added only the fork's user and assistant messages at 14–15. |
| Copies outlive sources | Removed the entire session directory. `read()` returned all positions 0–15 with the copied text; a fresh Bun process returned the same positions. The seeded `optmem` body was absent. |
| Kinds and historical models | Each run yielded user, agent, tool, echo, self, work, agent. The initial user carried `demo/first`; the assistant, tool call and result carried `demo/reply`; after a model change, self/work/final reply carried `demo/next`. The fork's new user retained `demo/next`, its assistant carried `demo/fork-model`. Thinking was absent. |
| Project and machine names | `lifeId("first-use", cwd)` resolved to `/home/mlegls/dev/mlegls-pi/.git:first-use` from both this linked worktree and the main checkout. Outside git it returned undefined. `/first-use` stayed machine-wide outside git. |
| Intermediate consumers remain loadable | Existing build tests imported `build.ts` and `index.ts` and passed. Branch source rendering remains `kind: text`; copied life inputs render `kind@place: text`. |

Existing regression command: `bun test extensions/context/life/log.test.ts extensions/context/life/build.test.ts lib/records/cursor.test.ts` — 8 passed, 0 failed. `bunx tsc --noEmit` passed. The existing parser test was updated for the deliberate classification/model behavior; no new test cases were added.

## Consumer boundary

`lifeId(name, cwd)` resolves the name. `lifeLog(id).append(lifeMessages(branch, context))` appends copied inputs. Supply `context.sessions = sessionChain(sm)` for a fork, alongside `session`, `place`, `model` and `selfThreads`; that optional field is the only addition to the shared contract. The session attachment/context ticket consumes this library later.

## Review

Read `log.ts`, the `store.ts` addition and `contracts.ts` against the ticket; no repairs needed. `bun test extensions/context lib/records` (37 pass) and `bunx tsc --noEmit` pass; the repository has no `test:affected` task. Beyond the driver's single schedule, I ran eight concurrent processes on a warm store, each appending forty runs of five own messages plus one source shared by all and a repeat of its own run: 1640 messages, positions exactly 0–1639, 1640 distinct sources, every run contiguous, 0.6 s. The same run with six processes started on a store file that did not yet exist lost two writers to `SQLITE_BUSY` in `db()` at `PRAGMA journal_mode = WAL` (the busy timeout does not cover the journal-mode switch); only the first-ever creation of the file is affected, and it predates this change. The `presence` files in the range arrive from the sibling presence ticket's merge and were not reviewed here.
