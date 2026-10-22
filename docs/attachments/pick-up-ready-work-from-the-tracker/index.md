# Pickup first use — 2026-10-22

Branch-pinned: the watcher and reconcilers ran from this branch's worktree (`lib/reconcile/pickup.ts`, `lib/reconcile/main.ts`), against the live bb, in a disposable repository `/tmp/pickup-firstuse/repo` with a scratch vault. No existing project's backlog was enabled. Owner: @thread:thr_4fbx9ak5cj (this session), budget 1 per run, settle 5 s.

## Setup

Scratch tree before enabling (`issues.ts tree`):

```
scratch-root        [own:goal effective:goal assignee:agent] unblocks:1        (drive: none)
scratch-blocked     [own:ticket assignee:agent prerequisites:scratch-root]
scratch-claimed     [own:ticket assignee:agent claimed:session:someone-shaping]
scratch-human       [own:ticket assignee:human]
scratch-incomplete  [own:spec effective:idea assignee:agent]  (child scratch-incomplete-child: idea)
scratch-outside     [own:ticket assignee:agent]   ← frontier, but outside the scope
```

Scope: scratch-root, scratch-blocked, scratch-claimed, scratch-human, scratch-incomplete. Enabled through `configure` (what the `pickup` tool calls); the watcher started (pid 67457) and its first scan started nothing.

## Observed

| time (UTC) | event |
|---|---|
| 11:40:04 | tracker write `issues.ts update scratch-root --fields '{"stage":"ticket"}'` (commit 5e78e63). No message to anyone. |
| 11:40:06 | change-triggered scan: `scratch-root: settling: changed 1s ago` |
| 11:40:11 | settle elapsed → `started scratch-root (pid 69332)`; reconciler log `started by pickup (budget 1)`, no "started" mail to the owner |
| 11:40:25 | watcher killed and restarted (pid 72005, recovery scan at start); then a second tracker write to scratch-root (priority 3) and a touch. Scans at 11:40:29 started nothing; still one `main.ts run scratch-root` process and one run state. |
| 11:41:11 | scratch-root implement → (drive skipped: `drive: none`) → review → landed in the scratch checkout, closed |
| 11:41:26 | the close unblocked scratch-blocked → pickup started it once, again with no message |
| ~11:43 | scratch-blocked done (implement → drive → review → landed) |
| after | `pickup.ts stop`: enabled false, watcher gone |

Final tree: scratch-root and scratch-blocked done; scratch-claimed, scratch-human, scratch-incomplete (+ child) and scratch-outside untouched (no run state for them). Pickup `started` holds exactly the two runs.

## Tests

`lib/reconcile/pickup.test.ts` (selection reasons, scan dedupe across rescans, pause, settle, explicit scope); `heavy bun test lib/reconcile/`: 30 pass.

## Retained limits

- The owner's session start relaunches a missing watcher (as with reconcilers); after a host restart nothing runs until that thread next starts a session. Same as reconcilers today.
- Pickup-started runs' workers are bb children of whichever thread's environment started the watcher (here the owner), so routine worker completion notices still arrive (existing reconciler behaviour, answered locally by `extensions/bb/local-completion.ts`).
- The reconcilers' "done" mails to the owner were not observed inside this turn (queued behind it); not re-verified here.
- A scratch bb project for `/tmp/pickup-firstuse/repo` was created by the workers' spawn (existing `bbProject` behaviour).
