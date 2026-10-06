---
stage: idea
assignee: agent
author: session:4b3f3835-f151-428e-979d-1025b1a2785e
---

Since 2026-10-03 04:30 UTC, concept workers die of an uncaught `EPIPE: broken pipe, write`. Each one died either right after a tool result, before its next model call, or on its first turn: the 2026-10-06 05:35:19 crash came about 2s after the initial prompt, about 80ms after stance routing. Pi's interactive crash handler exits on any uncaught exception, so every EPIPE cost a relaunch.

Evidence so far:
- Bun stacks name no caller.
  - Early crashes: a write stream being ended (`end → destroy`).
  - The one crash recorded in full: a stream's first buffered write after it was constructed (`onConstructed → clearBuffer → underscoreWriteFast`). That's a stream opened onto a peer that was already gone.
- At that crash, every open non-file fd was a unix socket. Bun uses socketpairs for child stdio. There were no pipes, and fds 0–2 weren't recorded.
- The worker's own stdio is a zmx tty.
- Ruled out:
  - the reconciler (it has no connection to workers' stdio);
  - the pi 0.99.2→1.0.0 bump (crashes started before it);
  - node:child_process stdin to a dead child (Bun reports `ERR_STREAM_DESTROYED` to the write callback);
  - pi-mcp's stdio transport (it listens for errors on its streams).
- Not ruled out: a lazily constructed `process.stderr`/`process.stdout`, and a Bun-internal stream.

`lib/session-meta/host.ts` handles this in two ways:
- **Records:** each EPIPE goes to `~/.pi/agent/epipe.jsonl`, with the error, stdout/stderr stream state, every non-file fd, and direct children.
- **Keeps the worker alive:** it wraps pi's uncaughtException handlers so an EPIPE no longer exits. That loses one stream's output instead of the session.

Still open: which stream it is. Once that's known, fix it there and drop the wrapper.
