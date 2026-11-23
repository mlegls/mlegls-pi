---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:01a20621-fdb8-74d3-8ab0-6ecb91858267"
part-of: "[[projects/mlegls-pi/issues/promised-wake-turns-end-with-nothing-to-wake-them]]"
claimed-by: "reconcile:promised-wake-turns-end-with-nothing-to-wake-them"
priority: 2
---
A turn whose final text promises to act on an event, with no live managed process to deliver that event, gets refused once before it ends. Part of [[projects/mlegls-pi/issues/promised-wake-turns-end-with-nothing-to-wake-them]]; the parent quotes the three threads that motivated it. This guard alone would not have caught them (their watchers were live at turn end); it catches the case where nothing was started at all.

## tasks

1. In the `agent_end` path of [extensions/guard/index.ts](../../extensions/guard/index.ts): when the final assistant text matches a promise to act on an event (starting point: `/\b(when|once)\b.{0,80}\b(finish|end|land|pass|complete)s?\b.{0,40}\bI'll\b|wakes me/i`) and the session has no live managed process (pi-processes), refuse the turn once with "Nothing is running that will wake this thread. Wait in the foreground with process wait, or hand the wait to an automation."
2. Done when: a test ends a turn on such a promise with no process and gets the refusal; the same text with a live managed process passes; a second turn end after the refusal passes.