---
stage: "done"
assignee: "agent:auto-routine"
author: "session:01a20621-fdb8-74d3-8ab0-6ecb91858267"
part-of: "[[projects/mlegls-pi/issues/promised-wake-turns-end-with-nothing-to-wake-them]]"
priority: 2
---
A turn whose final text promises to act on an event, with no live managed process to deliver that event, gets refused once before it ends. Part of [[projects/mlegls-pi/issues/promised-wake-turns-end-with-nothing-to-wake-them]]; the parent quotes the three threads that motivated it. This guard alone would not have caught them (their watchers were live at turn end); it catches the case where nothing was started at all.

## tasks

1. In the `agent_end` path of [extensions/guard/index.ts](../../extensions/guard/index.ts): when the final assistant text matches a promise to act on an event (starting point: `/\b(when|once)\b.{0,80}\b(finish|end|land|pass|complete)s?\b.{0,40}\bI'll\b|wakes me/i`) and the session has no live managed process (pi-processes), refuse the turn once with "Nothing is running that will wake this thread. Wait in the foreground with process wait, or hand the wait to an automation."
2. Done when: a test ends a turn on such a promise with no process and gets the refusal; the same text with a live managed process passes; a second turn end after the refusal passes.

## Result

done. All three stories still hold after my one fix. The packet now has a review section with the reruns.

The guard refused any promise when Pi had no session file (`--no-session` or an in-memory session). In that case pi-processes still runs processes but writes no receipt, so a live watcher couldn't be seen and the turn was refused anyway. Now a session without a file lets the turn end; with a session file, a missing receipt still means nothing is running.

The rest of the diff is fine. Moving `managedProcess` into `lib/thread/process.ts` changes nothing about how it behaves, and it treats the same statuses as live that pi-processes does. The handoff repair and the wake refusal share one follow-up per input, which is what the third story needs. The guard now runs for every session, not just workers, which the ticket asks for.

The replay passed both modes on the fixed head, and `bun test extensions/guard lib/reconcile` passed 69 tests. Nothing was filed and nothing is left running.

```yaml
commit: dedd2718
stories:
  - {story: "Refuse a promised wake when no managed process is live", outcome: held}
  - {story: "Allow the next turn end after the refusal", outcome: held}
  - {story: "Allow the same promise with a live managed process", outcome: held}
evidence:
  path: docs/attachments/guard-refuses-promised-wakes-with-no-live-process/index.md
  visual: false
  shots: []
tests: []
filed: []
fixed:
  - "dedd2718: a session with no session file is treated as unknown (turn ends) rather than refused; pi-processes writes no receipt then, so a live watcher was invisible"
caveats:
  - "Neither the replay nor any test covers a session without a session file; the fix is a single condition, so it was checked by reading the code only."
```

Evidence: [docs/attachments/guard-refuses-promised-wakes-with-no-live-process/index.md](../attachments/guard-refuses-promised-wakes-with-no-live-process/index.md)
