---
stage: idea
assignee: agent
author: session:01a0f0b1-e89f-7454-ba8a-cb0002c45448
---

During the second review of [[projects/mlegls-pi/issues/address-the-waiting-child-in-exception-mail]], an offline `pi --mode rpc` launched from the review worktree with ordinary extension discovery displayed only its `wt/` channel and wrote a live record without the new `boardDir`/ticket subscription. `pi list` identified the globally registered `mlegls-pi` package as `/Users/mlegls/dev/mlegls-pi` (canonical checkout), not the current worktree. This initial probe could not verify the reviewed revision, although `bun ab/main.ts mail` ran from the worktree; the first-use driver's bare Pi processes had the same version-identity ambiguity.

Workaround: launch `pi --no-extensions -e "$PWD/lib/board/host.ts" -e "$PWD/lib/session-meta/host.ts" --mode rpc` with isolated `XDG_DATA_HOME` and `XDG_STATE_HOME`. Confirm the live snapshot lists the expected issue ticket before sending. The explicitly loaded recipient acknowledged ticket mail and started a turn; see [second review](../attachments/address-the-waiting-child-in-exception-mail/index.md#second-review--2026-09-30). Consider a checkout-aware Pi drive command or setup guidance that pins the extension sources, so a real-looking worktree smoke cannot accidentally exercise the globally installed older implementation.
