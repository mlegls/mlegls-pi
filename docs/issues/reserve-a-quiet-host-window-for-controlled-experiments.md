---
stage: "idea"
assignee: "agent"
author: "session:reproduce-completed-mission-seed-on-a-quiet-host-implement-6"
priority: 3
---
During [[projects/concept/issues/reproduce-completed-mission-seed-on-a-quiet-host]], a worker could not establish the requested quiet-host condition on shared host `beelink`. Three minutes of five-second observations on 2026-11-03 showed 13.53–18.18 one-minute load on 16 logical CPUs and 44.63–95.12% aggregate CPU busy (mean 72.84%). No seeds were run or labeled quiet. The worker did not stop others' processes, and no alternate quiet host was prepared.

Evidence and runnable non-destructive observer: [[projects/concept/attachments/seed-mission-quiet/index]]. A separate Concept measurement already records two ten-minute waits without an idle window: [[projects/concept/issues/measure-cold-document-navigation-on-an-idle-host]].

This is a missing controlled experiment window, not proof of an admission-gate bug or a seed defect. [[projects/mlegls-pi/issues/host-load-times-out-existing-regressions]] owns queued heavy checks and references [[projects/mlegls-pi/issues/admit-workers-against-a-host-wide-budget]]; limiting concurrent workers does not itself reserve a quiet host. The local `heavy` queue cannot exclude already-running services and other actors.

Workaround: stop before seeding, retain the environment packet, and return a concrete blocker. Open choice for mlegls-pi/BB orchestration: how a supervisor obtains a quiet measurement window across owners, or assigns such work to another quiet host, without a worker terminating unrelated work.
