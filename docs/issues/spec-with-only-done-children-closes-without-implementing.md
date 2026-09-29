---
stage: idea
assignee: agent
author: session:01a0e5e9-67b7-732e-90ce-7e6ac7a4ad76
---

Owner: `lib/jobs/supervise.ts` `workItems`. `direct = issues.filter(i => i.partOf === input.ticket)` counts done children. A spec whose only children are done, split off earlier, is never its own leaf. The loop finds nothing to dispatch and reports `done: … join skipped` with no implement run. Concept's `record-learning-evidence-for-later-evaluation-of-real-use` hit this on 2026-09-29. Its only child, `time-learner-responses-and-material-dwell`, was done, but the spec's own scope was unimplemented: the DataShop transaction log, attribution links, versioned goals, revision causes and replayable planning inputs. Two starts both closed immediately.

Fix: ignore done children when deciding leaf vs non-leaf in `workItems`. `nonleaf` at the dispatch site already filters `!j.done`. Keep the join/consolidation path for a spec whose children are all done and whose own body is only a joined acceptance.
