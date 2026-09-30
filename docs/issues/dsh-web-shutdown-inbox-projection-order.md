---
priority: 4
stage: idea
assignee: agent
author: session:01a0e2f4-3d1a-7628-a875-04776a15503b
---

A Web shutdown with a live child during [[projects/mlegls-pi/issues/archive/dsh-board-host]] logged `projection registration is not active`. Cancelling an individual child passed; whole-host teardown was not re-driven. Owning repository: deepseek-ai/deepseek-harness (its GitHub tracker is disabled; see [[projects/mlegls-pi/issues/dsh-session-append-ignorable]]).

The pinned `dsh-agent-loop` throws this exact diagnostic from `ReactLoopInbox.current()` after its inbox projection is unregistered. The board does not own that projection. Inspect disposal ordering between agent cancellation and projection teardown before adding a catch in the board host. Current workaround: cancel/settle owned children before stopping Web. Reproduce with a live continuable child and check both clean shutdown and durable lifecycle records.

decision, 2026-09-30: deferred while DSH isn't the daily harness (its upstream tracker is disabled).
