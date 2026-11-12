---
stage: "ticket"
assignee: "agent:technical"
author: "session:01a1cd90-31ee-71eb-b6b4-d3031eb4ea79"
priority: 2
part-of: "[[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]"
claimed-by: "reconcile:one-life-for-a-named-agent-across-simultaneous-sessions/one-life-for-a-named-agent-across-simultaneous-sessions-refine-1"
---
goal: A named life keeps the messages it lived after their source sessions disappear. Concurrent sessions append whole runs in one permanent order; revisiting a branch never removes or repeats what was already remembered. This owns the durable log in [[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]] (names, log and kinds); attachment and context assembly are the later session ticket.

## shape

The mechanical move into [life/](../../extensions/context/life/) and [contracts.ts](../../extensions/context/life/contracts.ts) are already on the refinement branch. Implement `lifeLog(id): LifeLog` and `lifeMessages: LifeMessages` in [log.ts](../../extensions/context/life/log.ts). The parser retains optmem's paging, clipping and entry-to-message decomposition, adds the six-kind classification, and resolves each message's historical provider/id from model changes and assistant messages. Its inputs supply the source session, place and same-life thread ids. `life.source` is `entry:<session>/<entry>#<k>`.

The log stores schema `life`, with the parent's exact tags and copied text. Add the small immediate-transaction operation to [store.ts](../../lib/records/store.ts) that lets a read of the greatest position and several record writes share SQLite's write lock. Deduplicate sources inside that lock and number the new messages from zero in append order; each append's new messages stay contiguous. `read()` returns them in position order, independent of any branch or source file. Existing optmem records remain unread.

Provide the project-scoped/machine-wide name resolution needed by `/life`, following [notes.ts](../../extensions/context/notes.ts)'s git-common-dir convention. Keep the branch-facing exports the moved build and index currently use until their dependent tickets replace those consumers; they must remain loadable at this intermediate landing.

First use is the library surface with a temporary `PI_BOARD_DIR`: two separate processes append runs to one life, one repeats an already-appended source, and the committed messages are then read without their source files. Exercise a branch fork and model changes through `lifeMessages`. Forked branches carry their ancestors' entry ids; [branch.ts](../../lib/records/branch.ts)'s `sessionChain` supplies their session ancestry, so inherited messages already in the life can retain their original source refs. Update the existing moved [log.test.ts](../../extensions/context/life/log.test.ts) where its deliberate behavior changes.

Questions of intent go to `session:hermes-concept-strategy`, the owner named in the parent.
