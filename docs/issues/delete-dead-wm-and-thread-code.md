---
stage: "done"
assignee: "agent"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> ~350 of 551 lines in [wm.ts](../../lib/wm.ts) (`Poller`, `Worker.{turn,observe,next,events,done,send,capture,exec,status}`, `wait`, `merge`, `from: "summary"`, CLI), `executable()` ([process.ts](../../lib/thread/process.ts#L14)), `lastTurn` ([turn.ts](../../lib/thread/turn.ts#L122)), `.wm/setup.json` reader ([setup.ts](../../lib/thread/setup.ts#L17))

Delete what nothing imports (confirm each with a grep across the repo, bb-plugins and skills scripts). [views.ts](../../lib/views.ts) stays: the `orient` skill runs it. Also in [dispatch.ts](../../lib/dispatch.ts) `retire()`: it makes 3 redundant `bbThreads()` RPCs and can return `branchDeleted` together with `branchesKept: keepBranch requested`.

## Result

done. All six stories hold on 8f7afc11, including the two the driver couldn't observe.

- **Explicit keep-branch:** `dispatch.retire` has no keep option now. The only explicit way to keep a branch is `abandonThread(id, { keepBranch: true })`; `integrate keep:true` skips retirement entirely. I added a third worker to `first-use.ts`, merged and retired that way. It used one thread-list call, the thread was archived, the worktree removed and the branch kept with "keepBranch requested". Nothing was reported deleted. The other two receipts came out the same as in the driver's table.
- **Zero callers:** I searched this checkout, `~/dev/bb-plugins`, `~/.agents/skills` and `~/.pi/agent/skills` for every removed name and for any `lib/wm.ts` CLI use. The code that still imports `lib/wm` uses only `spawn`, `spawnEnv`, `pidAlive`, `excludeWm` and `SpawnOptions`, and all of those are still exported. The only other hits are old attachments and an unrelated private `executable` in `lib/thread/commit-hooks.ts`.
- **Checks:** `tsc --noEmit` is clean, the affected tests pass (35 of 35), and `bun lib/views.ts` still prints.

The diff had no defects to repair, and the driver filed no tracker issues to settle.

```yaml
commit: 8f7afc11
stories:
  - {story: Merged worker retirement reports deletion only, outcome: held}
  - {story: Unmerged worker retirement reports retention only, outcome: held}
  - {story: Each retirement uses one BB thread-list call, outcome: held}
  - {story: The orient views command still prints, outcome: held}
  - {story: Explicit keep-branch reports retention only, outcome: held}
  - {story: "Removed internals have no callers across the repo, BB plugins and skills", outcome: held}
evidence:
  path: docs/attachments/delete-dead-wm-and-thread-code/index.md
  visual: false
  shots: []
tests: []
filed: []
fixed: []
caveats:
  - "Explicit keep-branch was checked through abandonThread({ keepBranch: true }), since dispatch.retire no longer takes a keep option. That option and the `true` branch of KeepBranch in lib/thread/lifecycle-cleanup.ts have no callers outside this fixture now. They're a candidate for the same deletion, left alone because the ticket asked only about retire()."
  - "first-use.ts now dispatches three workers instead of two, adding about 1 s. It is still offline on fake BB."
```

Evidence: [docs/attachments/delete-dead-wm-and-thread-code/index.md](../attachments/delete-dead-wm-and-thread-code/index.md)
