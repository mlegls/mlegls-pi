---
stage: "done"
assignee: "agent"
author: "session:thr_3mb8axsh4t"
priority: 3
---
During [[projects/mlegls-pi/issues/life-session-attachment-and-run-context]] first-use drive at b23e2014f46e42592eb10d2032c83fba5eec393d, catch_up({thread}) on an unfinished bb sibling returned a 539-line, 14,543-token JSON message array. The sibling's actual task was hold("indigo bridge"), sleep 65, then a one-token reply. The returned array included system sections, tool definitions and opaque reasoning signatures; codemode truncated its display and wrote a full-output file. The caller still identified the held work and active sleep correctly. Observation: the sibling-read surface adds substantial unrelated material for a very small unfinished task. Whether/how to reduce it is an open product choice.

Replay: `bun scripts/life-playground.ts prepare-bb`, start two Pi Haiku 4.5 threads in the returned owned workspace; first holds and sleeps, second calls catch_up with the first thread ID while sleep is running. Threads in this encounter: @thread:thr_asc9cs23cc and @thread:thr_a8sn4m7xsr (now stopped/archived). [Evidence packet](../../docs/attachments/life-session-attachment-and-run-context/index.md). No workaround tested.

## Result

Fixed in review (dcec893d): catch_up(thread) omits the sibling's system-prompt message (23.3 KB to 3.9 KB for a fresh session's first run) and reports an empty read as '(no unfinished run there)'.

Evidence: [docs/attachments/life-session-attachment-and-run-context/index.md](../attachments/life-session-attachment-and-run-context/index.md)
