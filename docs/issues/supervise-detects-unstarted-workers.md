---
stage: done
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
---

A worker that never starts is invisible to the supervise loop. On 2026-09-27 `dsh-hashline-tools-spike` sat at pi's "Trust project folder?" prompt for about 10 minutes with no session file; `ab supervise status` showed `running` with `launched: 1`, nothing woke the owner, and `ab tree` showed nothing because nodes come from session files. The trust prompt itself is fixed (9ba57fa: `wm spawn` extends a trusted repo's trust to its `__worktrees` folder), but anything else that holds a worker before its first turn (an auth prompt, a crashed launch, a bad command) fails the same way.

Done when a launched child with no pi session (no session file carrying its `PI_WM_RUN`/`PI_WM_HANDLE`, or whatever `ab tree` uses to attach spawned workers) within a grace period wakes the owner through the existing `except` path in `lib/jobs/supervise.ts`, with the tail of its pane (`tmux capture-pane`) as the text, so the owner sees what it's stuck on. Children started with an explicit `command` (non-pi) are exempt or use the pane's liveness instead. A test drives it with a fake child that never writes a session.
