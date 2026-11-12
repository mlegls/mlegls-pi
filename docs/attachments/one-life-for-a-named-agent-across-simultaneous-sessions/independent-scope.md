# Parent drive scope

Reviewed revision: `7afffc3cee2eca512140fde12e1ee7fff6a0d64f`.

This parent delegates its runtime contract to four children. Its execution section assigns copied log/name resolution, presence/holds/unfinished reads, shared compaction, and session/context/first use to those children. It adds no separate user story beyond them. The assignment explicitly requests only the parent's own journeys and permits `stories: []` when none remain.

## Predictions and scope, before opening the product

No additional story predicts an observable state beyond the children's existing encounters. In particular, the two-session cross-child journey (attach, hold, overlap, inspect unfinished work, catch up completed work, preserve notes, resume/fork, model change and detach) belongs explicitly to the session/context child and has already been independently driven there. Interrupted-run recovery also belongs to that child's startup contract, not a new parent story.

## Evidence reviewed

- [Assembled implementation encounter](index.md): completed cross-session recall, interrupted-history recovery, environment consumption and detach. This is implementation evidence, not a fresh independent drive.
- [Independent session/context encounter and review re-drive](../life-session-attachment-and-run-context/index.md): the cross-child journey and repaired long-run summary coherence, with its original limits preserved.

No source, diff, test or fixture was read. The public setup launcher's help was invoked; no pi runtime or model request was started, no inherited data was changed, and no service was stopped. The inherited `/tmp/pi-life-EtM8pd` target was not reused. No new setup-readiness or behavioral acceptance claim is made.

## Outcomes

Stories: none beyond the delegated children. Frictions: none newly encountered. Expectations: no new product expectations exercised. Checks: none newly commissioned. This scope result does not upgrade the children's recorded observations or waive their remaining gates.

Nonvisual scope review; no screenshots or running resources.

## Join review

Reviewed the combined life change (`99f57444^..HEAD`, life files only) at `7afffc3c`; the driver's scope note stands (no stories beyond the children).

Seam repair, [append-scaling.ts](append-scaling.ts) replays it: `life.log.append` checked each message's `life.source` with a join the planner drove from the life's `life.id` tags, so every turn end (which re-offers the session's whole branch) cost O(branch × life) under SQLite's write lock. Before: 2000 messages 756 ms, 8000 messages 12.7 s per turn end (first append 15 s). After starting from the source tag: 3 ms and 15 ms (first append 0.4 s). Fixed in `6aedc896`.

Structural: the `life.id` record filter was written four times (log, presence, compactor, view); now `ofLife` in log.ts. `Settings.enabled` was written and never read (optmem's `enabled()` read it; life's is the attachment) and is gone. Both in `44dc580a`; `bun test extensions/context lib/records` passes before and after (37).

Not changed, measured: presence reads every `life.run`/`end`/`hold`/`detach` record of the life at each run start and `threads()` at each turn end; 3000 runs cost 20 ms for `threads()`. It grows with the life's age and is worth a look at thousands of runs.
