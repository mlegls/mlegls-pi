---
stage: idea
assignee: human
author: session:01a0f6e1-7eed-75bc-ba02-2800f2354d23
priority: 3
---

During [[projects/mlegls-pi/issues/measure-idle-pi-cost]], restarting a quiescent pi took about 1–3 seconds, making a 15-minute idle/unviewed reap attractive. But `lib/board/host.ts` polls subscriptions inside pi every second, and `lib/session-meta/host.ts` monitors child exits there every five seconds. A killed idle pi cannot receive its wake messages. Idle is not the same as having nothing left to do: parents await children, and workers await `needs-input` answers.

Origin: [[projects/mlegls-pi/stories/work-in-threads]]. [Measurements and recommendation](../attachments/measure-idle-pi-cost/index.md).

Keep these sessions resident unless another process owns their wake delivery. A possible extension to the thread registry is to resume on matching board mail as well as on view; that is not implemented by the measurement ticket. Until then, a blanket “reap idle and resume only on view” loses unattended progress.
