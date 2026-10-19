---
stage: "idea"
assignee: "human"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
---
Replace the board with bb's thread messages wherever bb covers it, and stop reconciler workers' lifecycle notices from waking the supervisor.

Decided 2026-10-19 by the maintainer: "bb is working consistently now, so i think we can get rid of the fallback systems in mlegls-pi (zmx, board) where bb can cover it. i think in practice bb mail is used more than the custom board, since it's easy to copy thread references from the gui." zmx went with `delete-the-zmx-thread-runtime`. The ab sidebar tree isn't needed either ("i don't need it since i'm consistently in bb now").

Measured in the concept supervisor @thread:thr_vetzcc74ex (bb thread, 10-12 to 10-19): reconciler workers are spawned with `--parent-thread` set to the supervisor (`bbParent` in `lib/thread/runtime.ts` falls back to `BB_THREAD_ID`), so bb sends the supervisor a "[bb system] @thread:… completed" turn for every phase of every worker. 1,234 such wakes cost $640 of Opus at ~190k context; 742 made no tool call and only restated status. The reconciler already consumes these completions and mails exceptions. The maintainer also saw the supervisor repeat what he was reading while he talked to a child directly.

Open for shaping:
- Which board uses bb covers: worker reports, mailboxes, `role/<repo>/supervisor` (a session that wants the supervisor needs to find its thread), wake subscriptions, reconciler exceptions mailed up. About 40 files in `lib`/`extensions` touch the board.
- How workers relate to the supervisor in bb: no parent or `--lifecycle-owner-thread` (archives with it, sends no notices), perhaps in a bb section; or keep `--parent-thread` and drop notices about reconciler-owned threads in an `input` handler (needs a check that bb accepts a prompt pi answers `handled` without a turn).
