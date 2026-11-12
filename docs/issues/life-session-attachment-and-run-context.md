---
stage: "ticket"
assignee: "agent:technical"
author: "session:01a1cd90-31ee-71eb-b6b4-d3031eb4ea79"
priority: 2
part-of: "[[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]"
claimed-by: "reconcile:one-life-for-a-named-agent-across-simultaneous-sessions/one-life-for-a-named-agent-across-simultaneous-sessions-refine-1"
blocked-by:
  - "[[projects/mlegls-pi/issues/life-compacts-one-shared-tree]]"
  - "[[projects/mlegls-pi/issues/life-present-working-threads-and-holds]]"
---
goal: The named life is usable in pi: two bb sessions attach to it, know where else they are working, and remember each other's completed runs from their next run. A long run stays coherent as it is appended and summarized. An unattached session uses OM. This joins names and attachment, context, saved views, looking, prompt and delegation from [[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]].

## shape

Wire the prerequisite log, shared compactor and presence into [life/index.ts](../../extensions/context/life/index.ts), [context/index.ts](../../extensions/context/index.ts) and [mechanism.ts](../../extensions/context/mechanism.ts). Their shared data/API boundary is [contracts.ts](../../extensions/context/life/contracts.ts); the log exports `lifeLog(id)` and `lifeMessages`, and presence exports `present(life)`.

`/life <name>` and `/life off` persist the attachment as a session entry, inherited on resume/fork. `PI_LIFE` attaches at startup and is deleted from `process.env` as soon as read. Attached means life owns compaction/context; detached means OM by default. Model changes preserve attachment. Finish the mechanism/settings rename and the references in [elide.ts](../../extensions/context/elide.ts), [notes.ts](../../extensions/context/notes.ts)'s header, and [recall.ts](../../extensions/context/recall.ts)'s store-schema description. Old optmem records are unread and unmigrated. Notes' behavior stays unchanged.

On attach, append the unappended branch as one run; on session start recover any unappended interrupted history. On a final assistant `turn_end` append the run in one log call. At run start capture the life position, advance/save a shared `life.view`, record presence and fix `[view][present][whole current run]` for that run. Only a view with greater `upTo` advances the saved view; do not replace a newer saved view with empty or older state. The first request waits for summaries within `waitSeconds` while observing other builders. Past `tailBytes`, append a safe prefix before advancing its boundary and view, preserving tool-call/result grouping and the user's whole message as in the parent's shape.

Expose `hold`, `catch_up`, `zoom` and `date` only while attached. `catch_up()` returns leaf lines after this run's view with their places; `catch_up(thread)` renders presence's sibling run read. Zoom/date navigate the whole committed life, including positions newer than the fixed view. Rewrite [prompt.md](../../extensions/context/life/prompt.md) and [prompt.ts](../../extensions/context/life/prompt.ts) in the parent's agreed grammar: one subject in several threads, self messages owe no reply, overlapping runs' conflicts stay visible. Finish removing transitional branch-only compactor glue. Update the existing mechanism/build tests where behavior deliberately changes.

First use is two actual pi sessions on one temporary store and named life, with notes available beside it. Prepare a reproducible entry point and short usage guide for `/life`, the machine-wide name form, `PI_LIFE` and the tools. The drive should attach history, hold work, overlap runs, finish one and catch it up from the other, inspect an unfinished sibling, resume/fork, switch model, and detach. Force a long run with a small configured `tailBytes` to observe append-before-boundary and complete tool pairs. Show a child process does not inherit `PI_LIFE`; an explicitly named worker can attach. The Hermes import and Beelink trial remain their existing separate issues.

Questions of intent go to `session:hermes-concept-strategy`, the owner named in the parent.
