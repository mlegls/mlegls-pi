---
stage: "done"
assignee: "agent:technical"
author: "session:01a1cd90-31ee-71eb-b6b4-d3031eb4ea79"
priority: 2
part-of: "[[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]"
---
goal: The named life is usable in pi: two bb sessions attach to it, know where else they are working, and remember each other's completed runs from their next run. A long run stays coherent as it is appended and summarized. An unattached session uses OM. This joins names and attachment, context, saved views, looking, prompt and delegation from [[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]].

## shape

Wire the prerequisite log, shared compactor and presence into [life/index.ts](../../extensions/context/life/index.ts), [context/index.ts](../../extensions/context/index.ts) and [mechanism.ts](../../extensions/context/mechanism.ts). Their shared data/API boundary is [contracts.ts](../../extensions/context/life/contracts.ts); the log exports `lifeLog(id)` and `lifeMessages`, and presence exports `present(life)`.

`/life <name>` and `/life off` persist the attachment as a session entry, inherited on resume/fork. `PI_LIFE` attaches at startup and is deleted from `process.env` as soon as read. Attached means life owns compaction/context; detached means OM by default. Model changes preserve attachment. Finish the mechanism/settings rename and the references in [elide.ts](../../extensions/context/elide.ts), [notes.ts](../../extensions/context/notes.ts)'s header, and [recall.ts](../../extensions/context/recall.ts)'s store-schema description. Old optmem records are unread and unmigrated. Notes' behavior stays unchanged.

On attach, append the unappended branch as one run; on session start recover any unappended interrupted history. On a final assistant `turn_end` append the run in one log call. At run start capture the life position, advance/save a shared `life.view`, record presence and fix `[view][present][whole current run]` for that run. Only a view with greater `upTo` advances the saved view; do not replace a newer saved view with empty or older state. The first request waits for summaries within `waitSeconds` while observing other builders. Past `tailBytes`, append a safe prefix before advancing its boundary and view, preserving tool-call/result grouping and the user's whole message as in the parent's shape.

Expose `hold`, `catch_up`, `zoom` and `date` only while attached. `catch_up()` returns leaf lines after this run's view with their places; `catch_up(thread)` renders presence's sibling run read. Zoom/date navigate the whole committed life, including positions newer than the fixed view. Rewrite [prompt.md](../../extensions/context/life/prompt.md) and [prompt.ts](../../extensions/context/life/prompt.ts) in the parent's agreed grammar: one subject in several threads, self messages owe no reply, overlapping runs' conflicts stay visible. Finish removing transitional branch-only compactor glue. Update the existing mechanism/build tests where behavior deliberately changes.

First use is two actual pi sessions on one temporary store and named life, with notes available beside it. Prepare a reproducible entry point and short usage guide for `/life`, the machine-wide name form, `PI_LIFE` and the tools. The drive should attach history, hold work, overlap runs, finish one and catch it up from the other, inspect an unfinished sibling, resume/fork, switch model, and detach. Force a long run with a small configured `tailBytes` to observe append-before-boundary and complete tool pairs. Show a child process does not inherit `PI_LIFE`; an explicitly named worker can attach. The Hermes import and Beelink trial remain their existing separate issues.

Questions of intent go to `session:hermes-concept-strategy`, the owner named in the parent.

## drive evidence

[Independent first-use packet](../attachments/life-session-attachment-and-run-context/index.md) at b23e2014f46e42592eb10d2032c83fba5eec393d: shared CLI and bb sessions, unfinished sibling read, overlap/catch_up, newer zoom/date, notes, model-ID change, resume/fork and detach held at their observed surfaces. Long-run prefix summaries mixed prior work and incorrect repetition counts; see [[projects/mlegls-pi/issues/life-long-run-prefix-summary-mixes-earlier-work]]. Full outcomes and remaining unobserved gates are in the packet. Ticket remains open for review and integration.

## Result

done. The failed long-run summary story now holds on head `e6e7af99`; I repaired it and re-drove it with a fresh packet section.

**Cause.** In the driver's store, leaf 37 never got a summary. A session that won its `life.lease` then exited, so every later session waited out the ten-minute lease. A compactor call only saw lines up to the first unbuilt one, so every later call lacked its own run. It copied the prior run's "150 times" and `WHOLE-USER-963` instead. Replaying leaves 78/81 against Haiku in that state, 8/8 summaries were wrong. With the run's context present, 12/12 were right.

**Repairs** (each committed on its own):
- `contextLines` in `build.ts` now continues past the first unbuilt line with the nearest messages as leaves, unbuilt ones cut to their head. Replay with the leaf still stuck: 12/12 say 250 and name `PRESERVE-612`.
- A long run in `index.ts` still appends its prefix. It no longer waits `waitSeconds` again at every request for history stuck before it. With the lease stuck, the same task took about 39 s instead of the driver's roughly 3m45.
- `catch_up(thread)` drops the sibling's system-prompt message (23.3 KB to 3.9 KB for a fresh session's first run). An empty read now says `(no unfinished run there)`.

**Re-drive.** Fresh playground stores, real pi RPC, Haiku 4.5, `tailBytes` 800, with the prior six-call run seeded:
- **Stuck lease:** all four current-run summaries say 250 and `PRESERVE-612`.
- **No stuck lease:** same summaries, and the saved view advanced 15, 16, 19, 22, 25.

**Tracker.**
- Closed `life-long-run-prefix-summary-mixes-earlier-work` and `life-unfinished-sibling-read-large-system-payload` as fixed.
- Kept `life-first-use-compaction-empty-reply-warning` as an idea. I appended my findings and the evidence it now waits on: the failing call's `stopReason`. I couldn't reproduce it by replaying leaf 37's prompt nine times.
- Filed `life-compactor-lease-outlives-its-builder` (idea). The open choice is release-on-exit, heartbeat, or a pid check.

I read the code for `viewAt` (monotone `life.view` writes) and for the append-before-boundary order; the driver's packet already lists both as unobservable.

```yaml
commit: [ba78d230, dcec893d, e6e7af99]
stories:
  - story: Two real pi and bb sessions share a named life and remember completed work
    outcome: held
  - story: Holds and unfinished sibling work are discoverable
    outcome: held
  - story: Overlapping runs expose newer committed places through catch_up, zoom and date
    outcome: held
  - story: Notes compose with life; model-ID change, resume, fork and detach preserve the expected attachment
    outcome: held
  - story: PI_LIFE disappears from child environments; explicitly named workers attach
    outcome: held
  - story: Long-run prefixes retain whole user messages and complete tool pairs
    outcome: held
  - story: Long-run summaries remain semantically coherent
    outcome: held
  - story: Interrupted-history recovery and internal saved-view ordering
    outcome: held
evidence:
  path: docs/attachments/life-session-attachment-and-run-context/index.md
  visual: false
  shots: []
tests: [extensions/context/mechanism.test.ts, extensions/context/life/build.test.ts]
filed: [life-compactor-lease-outlives-its-builder]
fixed:
  - "life-long-run-prefix-summary-mixes-earlier-work (ba78d230)"
  - "life-unfinished-sibling-read-large-system-payload (dcec893d)"
redrive: false
caveats:
  - "Interrupted-history recovery has no live or replay drive; it is code-read only (session_start appends the unappended branch, deduped by source). The last story is marked held on that basis."
  - "Concurrent-builder waiting and the exact append-before-boundary transaction order are code-read only, not driven."
  - "A stuck early lease still costs each run's first request waitSeconds (30 s), and the sawtooth boundary can't advance until it expires; the filed lease issue owns that."
  - "The extra compactor context is capped at the compactor view's low budget (16 KB default), at most that much more per call, only while a line is stuck."
  - "Model switch covered distinct Haiku IDs only, as in the driver's packet."
  - "No test changes; proposed test: none."
  - "/tmp/pi-life-hgWnTO, /tmp/pi-life-I7Y5TF, /tmp/pi-life-XKmWxG, /tmp/pi-life-Bmfklq, /tmp/pi-life-JHDvT8 remain as disposable data. No runtime of mine is running."
```

Evidence: [docs/attachments/life-session-attachment-and-run-context/index.md](../attachments/life-session-attachment-and-run-context/index.md)
