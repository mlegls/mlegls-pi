# Preparation safety — 2026-09-21

Follow-up to [the reader-profile investigation](autoread-reader-profile-2026-09-21.md).

## Changes

- Both reader backends use the same current-request wrapper. It identifies the child after inherited parent messages and asks for the current answer, not a promise to wait. The system stance also states that parent promises, exec state and notifications are not present in the child.
- Orientation stops at frontier, claims/blockers, governing constraints and entry points, or an explanation of missing evidence. Research inventories, audits and implementation discovery remain the assigned session’s work.
- Default-profile exec supplies `await poll(promise)`: pending/ready/failed snapshots, without waiting for completion or cancelling the work. Ready values and original errors are retained. Advance/introduce skills and docs now use it, including when checking early. Directly awaiting the work can still hit the cell deadline.
- Preparation asks a narrow briefing-validity question alongside its existing Jev difficulty question. Non-briefings reject before candidate/triage work. The error keeps `reader` (full answer and provenance) and `briefing` (the decision); successful audit keeps the decision too. There is no new API round trip and no automatic retry. Direct autoread transport checks and verbatim reasoning-triage handling are unchanged.

## Driven behavior

A real Kernel returned pending for an unresolved promise without blocking. Another cell fulfilled it and got the ready object; the earlier pending snapshot stayed unchanged and unrelated state remained 42. A rejected REPL promise yielded failed with the original Error object by identity.

The first implementation exposed a cross-realm Promise timing issue: one microtask did not drain REPL promise adoption. Poll now yields one event-loop turn, not the duration of the task. Repeating the drive returned ready/failed correctly in the resolving/rejecting cell.

Live Jev probes used the actual question literals from `lib/prepare.ts`, the current workflow policy, and request/context state. The first row is the exact observed reader answer from session `01a0c206-1fe6-764e-94ff-a644b01a7854`; other rows are synthetic boundary examples.

| Input | Result | Selected probability |
| --- | --- | --- |
| observed role confusion | nonbriefing | 1 |
| status only | nonbriefing | 1 |
| explained missing tracker | usable | 0.96 |
| bounded orientation | usable | 0.97 |
| quoted failure within findings | usable | 0.73 |

An initial quoted-failure probe was marginal and changed class when paired with an unrelated parent scope. The final probe uses its actual investigation request, and the instructions explicitly distinguish the reader’s own waiting from waiting quoted as evidence. This is limited verification, not calibrated accuracy or a deterministic guarantee. Full reader latency and resistance to inherited context were not re-driven with live reader model sessions here; no new BB threads were launched.

`env -u BB_THREAD_ID bun test`: 203 pass, 2 skip, 0 fail. `bunx tsc --noEmit`: pass. No tests were added.

SCC versus `fc8a27e` (the separate BB integration landed during this work), scoped to `extensions/exec`, `lib/autoread.ts`, `lib/autoread`, and `lib/prepare.ts`: code 3516 → 3552 (+36), complexity 1211 → 1217 (+6). The added costs are one weakly held observer per polled promise and one parallel semantic question in the existing decision call. Remaining cost: semantic acceptance can misclassify; rejecting retains evidence rather than silently retrying.
