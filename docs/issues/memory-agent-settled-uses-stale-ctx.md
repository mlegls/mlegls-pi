---
stage: idea
assignee: agent
author: "session:01a0e82e-355d-76ee-884c-e3e6e0f99a82"
---

The `agent_settled` handler in `extensions/memory/index.ts` (around line 210) reads `ctx.cwd` from a ctx that pi 0.87.1 considers stale after a session replacement or reload, and throws "This extension ctx is stale after session replacement or reload". In the 2026-09-26 concept campaign, a drive worker (pin-this-edition-lasts-one-document-drive) crashed at turn end with this error, right after `<boundary>` failed with "turn_end could not resolve the persisted assistant entry ID". The supervise loop recorded the drive as `unreachable` and the worker had to be restarted by mail. pi's message says post-replacement work belongs in `withSession`, using the ctx that callback is given.
