---
stage: "done"
assignee: "agent"
author: "session:thr_3mb8axsh4t"
priority: 2
---
A long real pi run lost semantic accuracy in its committed prefix during [[projects/mlegls-pi/issues/life-session-attachment-and-run-context]] first-use drive at b23e2014f46e42592eb10d2032c83fba5eec393d. Public catch_up returned leaves describing the current run's first three bash outputs as repeated 150 times, although each actual command and result printed 250 repetitions. The first result leaf also imported the prior run's marker WHOLE-USER-963, although this run's marker was PRESERVE-612. The current user's full message and all completed tool pairs remained present. This is observed summary contamination, not established loss in the original source.

Reproduce on a fresh documented playground with tailBytes 800. First complete a run printing six different words 150 times each with marker WHOLE-USER-963. Then in a new attached session request four sequential bash calls, one assistant message per call, each `python3 -c "print('word N ' * 250)"`, N 1 through 4, with user marker PRESERVE-612. Call catch_up after all four results. In this encounter places 78,81,84 said 150; place 78 imported WHOLE-USER-963. Expected: summaries preserve 250 and associate this work with PRESERVE-612. No workaround demonstrated; originals were not inspected through zoom in this trial. [Evidence packet](../../docs/attachments/life-session-attachment-and-run-context/index.md).

## Result

Fixed in review (ba78d230): a call's context stopped at the first unbuilt line, so with an early leaf stuck behind a dead builder's lease every later call lacked its own run and copied the prior run's lines. contextLines now continues with the nearest messages as leaves. Replay of the failing leaves: 8/8 wrong before, 12/12 and a live re-drive correct after.

Evidence: [docs/attachments/life-session-attachment-and-run-context/index.md](../attachments/life-session-attachment-and-run-context/index.md)
