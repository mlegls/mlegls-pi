---
stage: "done"
assignee: "agent:auto-routine"
author: "session:01a1cd90-31ee-71eb-b6b4-d3031eb4ea79"
priority: 2
part-of: "[[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]"
---
goal: Before working in one thread, the agent can see where else it is working, what it holds there, and where it is open to messages. It can read what it just said in another thread even before that run finishes. This owns the present and sibling-in-progress reading in [[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]; bb already delivers messages to busy threads.

## shape

Implement `present(life): LifePresence` in a new `present.ts` under [life/](../../extensions/context/life/), using [contracts.ts](../../extensions/context/life/contracts.ts). It can run in parallel with the log ticket: its persistence and bb/session-file reads are independent of the log and compactor. The later session ticket registers tools and calls this API.

Each `start` writes a `life.run` with its id, session, bb thread when present, session file, pid and time; `end` records the matching run's end. Holds are one line per session, empty clears. Build `snapshot()` from one batched `bb thread list --thread <id>… --json` call: running threads are working, idle unarchived threads are open; show their titles, since when and holds. Outside bb use unended runs with live pids for working. `threads()` supplies the life's thread ids for `self` recognition. `readRun(thread)` reads the sibling's current run whole from its recorded session file, without opening a writer or importing the session mechanism. Expose any small lifecycle operation needed for a detached session to stop appearing as attached.

First use is this library API with an isolated store and real bb metadata for checkout-owned threads where available, plus plain sessions to exercise the pid fallback. Demonstrate that a second process sees a hold, clears it, reads a sibling's unfinished run, and distinguishes working from open/archived or ended places. The implementation handoff supplies the prepared entry point and identifiers so the driver can repeat it.

Questions of intent go to `session:hermes-concept-strategy`, the owner named in the parent.

## Result

done — no repairs needed. I replayed the driver's `try.ts` against real bb metadata, and it behaved as the packet records.

- **Review:** `present.ts` matches the ticket. `readRun` parses the session file directly, tolerates an in-flight final line, and returns only the entries after the last completed assistant message. `snapshot` makes one batched `bb thread list --thread … --include-hidden --json` call. Archived and deleted threads are dropped. The pid fallback applies only to plain sessions. `detach` is the small lifecycle addition, and it is on the `LifePresence` contract.
- **Checks run:** `bun run typecheck` passes. `bun test extensions/context/life` passes 14 tests. `mise run test:affected` doesn't exist in this project (only `test` and `setup`), so I ran the life tests directly.
- **Frictions:** none were filed by the driver or implementer, so there was nothing to triage.
- **Join/structure:** this is a leaf, so there is no join pass.

```yaml
commit: e5960113
stories:
  - story: A second process sees and clears another session's hold
    outcome: held
  - story: Read a sibling's unfinished current run
    outcome: held
  - story: Distinguish working, open and archived bb threads
    outcome: held
  - story: Plain-session presence excludes dead, ended and detached runs
    outcome: held
evidence:
  path: docs/attachments/life-present-working-threads-and-holds/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - "Sibling transcript is seeded; concurrent live writing was not exercised, only the partial-final-line tolerance."
  - "snapshot() throws if the bb call fails or times out (30 s). Callers should decide how to degrade."
  - "readRun() returns [] when the sibling's last entry is a completed assistant message, so a finished run reads empty. That matches 'unfinished run', but the session ticket should know."
  - "Cost: one bb CLI spawn per snapshot, whatever the number of threads. Presence reads the shared records store with no cache."
```

Evidence: [docs/attachments/life-present-working-threads-and-holds/index.md](../attachments/life-present-working-threads-and-holds/index.md)
