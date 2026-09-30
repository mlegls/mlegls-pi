---
stage: idea
priority: 3
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

[[projects/mlegls-pi/issues/decision-broadcasts-read]] found the only unread decisions in the factor-finish corpus were a 19-decision tail (09-15, `finish-private-hub` ×8, `finish-hub-remainder` ×11): the decisions were posted on the base topic, and the remaining pollers read `topic/*`, which by `matchTopic` (`lib/board/query.ts`) matches one segment below the base and never the base itself. `topic/**` does match the base (globstar includes zero segments). [Report](../../analysis/decision-broadcasts-read/report.md).

The worker preamble still teaches `{{run}}/*` (`agents/_common.md`), as do `docs/dispatch.md` and the multi-agent skill. Whether current supervise runs post anything on the bare run topic is unmeasured.

Possible fixes: teach `{{run}}/**` (also matches nested runs' topics, more noise), or make decisions always go on `<run>/<handle>` so `<run>/*` is complete. Prior art: MQTT's `a/#` matches `a` itself; `+` (like `*`) doesn't.
