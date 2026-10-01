---
stage: done
assignee: agent
author: session:01a0f69a-dbcb-7684-87de-422739d2c54e
part-of: "[[projects/mlegls-pi/issues/thread-registry-on-zmx]]"
blocked-by: ["[[projects/mlegls-pi/issues/thread-core-and-workers-on-zmx]]"]
priority: 2
---

Session mode: hacking. The pi side of [[projects/mlegls-pi/issues/thread-registry-on-zmx]], in `extensions/workspace/`:

- `/thread new|fork [--worktree <name>]|promote|archive|abandon|merge`, calling `ab thread`. `/fork-tab` becomes an alias of `/thread fork`.
- a `session_switch` hook that moves the thread's current session on `/new`/`/resume` in a canonical pi; free sessions are untouched.
- `/workspace <path>` in a canonical pi forks a new thread there instead of moving this one; unchanged in free sessions.

First use: in a canonical pi, `/new`, then quit pi and see it come back on the new session; `/thread fork --worktree x` and find the fork in `ab thread ls --tree spawn`; `/thread promote` a free session.

## Verification

[Independent first-use packet](../attachments/thread-commands-in-pi/index.md), including [predictions and replayable checks](../attachments/thread-commands-in-pi/drive.md). Lifecycle commands failed on c496408; reviewer repaired them (optional thread id, detached when the target contains this pi) and all journeys held.

## Verification evidence

[Encounter and evidence](../attachments/thread-commands-in-pi/index.md).
