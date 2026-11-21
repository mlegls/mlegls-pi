---
stage: "done"
assignee: "agent:auto-routine"
author: "session:thr_k5fkfxtxss"
---
After moving out the only node following external closure, the owner received `retired workers for solo; the closed issue is unchanged`, followed by `done: solo landed in the owner’s checkout at 8b117cd`. That was the preexisting external closure commit. The run did not land anything. The final notice makes it look like the run delivered work when it only retired the worker.

Replay: [externally closed node drive](../attachments/move-out-of-a-closed-node-assigns-it-to-human/index.md).

## Result

Folded into move-out-of-a-closed-node-assigns-it-to-human: its review includes the notice repair (991e708c) and replay. No separate implementation remains.
