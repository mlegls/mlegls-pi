---
stage: "idea"
assignee: "agent"
author: "session:thr_79y4adjv6d"
---
A BB worker can post a valid first-line `done` and still get the reconciler no-status nudge. On 2026-11-18 @thread:thr_79y4adjv6d repeated the successful implement handoff three times. BB's event log has the `agentMessage` at seq 1200 with first line `done`, followed by `turn/completed` at 1203 with `status: completed`. Passing `.data.item.text` from seq 1200 through `lib/report.ts` returned `{"status":"done","hasHandoff":true,"handoffError":null}`. The supervisor accepted the handoff from the conversation, but reposting did not advance the reconciler. This differs from [[projects/mlegls-pi/issues/handoff-without-a-first-line-status-escalates-after-repairs]], where the worker omitted the sentinel.

`lib/thread/turn.ts` pairs the completion event with a separate `bb thread output` call and drops message events. `bb thread output … --json` returned empty on the next active turn; that does not establish what it returned at the earlier poll. Check for a race in the latest-output projection. One repair candidate is to bind the final agent message to the completed turn in the event log and retain it across pages. Workaround: recover the handoff directly from the recorded message for the completed turn; repeating the report alone did not help.
