---
stage: "done"
assignee: "agent:technical"
author: "session:01a1cd90-31ee-71eb-b6b4-d3031eb4ea79"
priority: 2
part-of: "[[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]"
---
goal: A named life keeps the messages it lived after their source sessions disappear. Concurrent sessions append whole runs in one permanent order; revisiting a branch never removes or repeats what was already remembered. This owns the durable log in [[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]] (names, log and kinds); attachment and context assembly are the later session ticket.

## shape

The mechanical move into [life/](../../extensions/context/life/) and [contracts.ts](../../extensions/context/life/contracts.ts) are already on the refinement branch. Implement `lifeLog(id): LifeLog` and `lifeMessages: LifeMessages` in [log.ts](../../extensions/context/life/log.ts). The parser retains optmem's paging, clipping and entry-to-message decomposition, adds the six-kind classification, and resolves each message's historical provider/id from model changes and assistant messages. Its inputs supply the source session, place and same-life thread ids. `life.source` is `entry:<session>/<entry>#<k>`.

The log stores schema `life`, with the parent's exact tags and copied text. Add the small immediate-transaction operation to [store.ts](../../lib/records/store.ts) that lets a read of the greatest position and several record writes share SQLite's write lock. Deduplicate sources inside that lock and number the new messages from zero in append order; each append's new messages stay contiguous. `read()` returns them in position order, independent of any branch or source file. Existing optmem records remain unread.

Provide the project-scoped/machine-wide name resolution needed by `/life`, following [notes.ts](../../extensions/context/notes.ts)'s git-common-dir convention. Keep the branch-facing exports the moved build and index currently use until their dependent tickets replace those consumers; they must remain loadable at this intermediate landing.

First use is the library surface with a temporary `PI_BOARD_DIR`: two separate processes append runs to one life, one repeats an already-appended source, and the committed messages are then read without their source files. Exercise a branch fork and model changes through `lifeMessages`. Forked branches carry their ancestors' entry ids; [branch.ts](../../lib/records/branch.ts)'s `sessionChain` supplies their session ancestry, so inherited messages already in the life can retain their original source refs. Update the existing moved [log.test.ts](../../extensions/context/life/log.test.ts) where its deliberate behavior changes.

Questions of intent go to `session:hermes-concept-strategy`, the owner named in the parent.

## Result

done

The log holds under concurrency, and I made no code repairs. I read `log.ts`, the `store.ts` addition and `contracts.ts` against the ticket. `bun test extensions/context lib/records` passes (37 tests) and `bunx tsc --noEmit` is clean. The repo has no `test:affected` task, so I ran those directly.

I stress-tested beyond the driver's single schedule. Eight concurrent processes on a warm store each did forty appends of 5 own messages plus 1 source shared by all, with the run repeated inside the same call. The result was 1640 messages at positions exactly 0–1639, 1640 distinct sources, every run contiguous, in 0.6 s.

Six processes started against a store file that didn't exist yet lost two writers to `SQLITE_BUSY` at `PRAGMA journal_mode = WAL` in `db()` (`lib/records/store.ts`). The busy timeout doesn't cover the journal-mode switch. This only hits the very first creation of the file and predates this change, so I left it in the caveats and filed nothing.

The range also contains `present.ts` and the `detach` contract addition, which came from the sibling presence ticket's merge. I did not review them.

The tracker friction check found nothing filed by the workers or the driver.

```yaml
commit: 56f6f153
stories:
  - story: Concurrent processes append whole runs in permanent position order
    outcome: held
  - story: Repeated sources and fork ancestors are not duplicated
    outcome: held
  - story: Copied messages survive deletion of their source sessions
    outcome: held
  - story: Six kinds and historical provider/model identities are preserved
    outcome: held
  - story: Project-scoped and machine-wide names resolve distinctly
    outcome: held
  - story: Intermediate branch-facing consumers remain loadable
    outcome: held
evidence:
  path: docs/attachments/life-log-copies-and-orders-runs/index.md
  visual: false
  shots: []
tests:
  - extensions/context/life/log.test.ts
filed: []
caveats:
  - "Fresh-store race: concurrent first creation of the SQLite file can fail with SQLITE_BUSY at the WAL switch in db(). It predates this change and only affects the first creation of the file."
  - "Fork-ancestor lookup (inheritedSources) scans life.source tags with substr(), which can't use the tags_kv index. It runs only for forks; cost is linear in log size per fork append."
  - "Stress run was on a local warm store; no long-duration audit."
```

Evidence: [docs/attachments/life-log-copies-and-orders-runs/index.md](../attachments/life-log-copies-and-orders-runs/index.md)
