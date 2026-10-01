---
stage: done
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/archive/supervise-loop-reliability]]"
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

[[projects/mlegls-pi/issues/archive/decision-broadcasts-read]] found the only unread decisions in the factor-finish corpus were a 19-decision tail (09-15, `finish-private-hub` ×8, `finish-hub-remainder` ×11): the decisions were posted on the base topic, and the remaining pollers read `topic/*`, which by `matchTopic` (`lib/board/query.ts`) matches one segment below the base and never the base itself. `topic/**` does match the base (globstar includes zero segments). [Report](../../analysis/decision-broadcasts-read/report.md).

The worker preamble still teaches `{{run}}/*` (`agents/_common.md`), as do `docs/dispatch.md` and the multi-agent skill. Whether current supervise runs post anything on the bare run topic is unmeasured.

Possible fixes: teach `{{run}}/**` (also matches nested runs' topics, more noise), or make decisions always go on `<run>/<handle>` so `<run>/*` is complete. Prior art: MQTT's `a/#` matches `a` itself; `+` (like `*`) doesn't.

ticket contract, 2026-09-30: peers read base-topic decisions: the worker preamble (`agents/_common.md`), `docs/dispatch.md` and the multi-agent skill teach a pattern that matches the run's base topic and its children (e.g. `{{run}}/**`), or `matchTopic` treats `x/*` as including `x` if that's the better contract. Pick one, apply it everywhere it's taught, and test it.

## Result

Teach `<run>/**` in the worker preamble, dispatch docs and multi-agent skill; keep `matchTopic` unchanged. Instructions explicitly include base-topic decisions and nested descendants, and keep decision reads separate from report tag filters.

[Implementation first use and replay](../attachments/run-glob-misses-base-topic-decisions/index.md): isolated CLI board returned base, peer and nested decisions with globstar; the old single-segment pattern missed the base. Existing board regressions: 30 pass, 0 fail.

[Independent drive](../attachments/run-glob-misses-base-topic-decisions/drive.md): both ticket stories held through delivered instructions and isolated CLI/Bash reads. Prediction log and replayable checks are in the packet. CLI waiting also reached a fresh base decision; host subscription lifecycle was not exercised. Discovery friction filed as [[projects/mlegls-pi/issues/board-cli-help-runs-required-argument-validation]].

## Verification evidence

[Encounter and evidence](../attachments/run-glob-misses-base-topic-decisions/index.md).
