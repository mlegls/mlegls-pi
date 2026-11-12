---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:01a1cd90-31ee-71eb-b6b4-d3031eb4ea79"
priority: 2
part-of: "[[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]"
claimed-by: "reconcile:one-life-for-a-named-agent-across-simultaneous-sessions/one-life-for-a-named-agent-across-simultaneous-sessions-refine-1"
---
goal: Before working in one thread, the agent can see where else it is working, what it holds there, and where it is open to messages. It can read what it just said in another thread even before that run finishes. This owns the present and sibling-in-progress reading in [[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]; bb already delivers messages to busy threads.

## shape

Implement `present(life): LifePresence` in a new `present.ts` under [life/](../../extensions/context/life/), using [contracts.ts](../../extensions/context/life/contracts.ts). It can run in parallel with the log ticket: its persistence and bb/session-file reads are independent of the log and compactor. The later session ticket registers tools and calls this API.

Each `start` writes a `life.run` with its id, session, bb thread when present, session file, pid and time; `end` records the matching run's end. Holds are one line per session, empty clears. Build `snapshot()` from one batched `bb thread list --thread <id>… --json` call: running threads are working, idle unarchived threads are open; show their titles, since when and holds. Outside bb use unended runs with live pids for working. `threads()` supplies the life's thread ids for `self` recognition. `readRun(thread)` reads the sibling's current run whole from its recorded session file, without opening a writer or importing the session mechanism. Expose any small lifecycle operation needed for a detached session to stop appearing as attached.

First use is this library API with an isolated store and real bb metadata for checkout-owned threads where available, plus plain sessions to exercise the pid fallback. Demonstrate that a second process sees a hold, clears it, reads a sibling's unfinished run, and distinguishes working from open/archived or ended places. The implementation handoff supplies the prepared entry point and identifiers so the driver can repeat it.

Questions of intent go to `session:hermes-concept-strategy`, the owner named in the parent.
