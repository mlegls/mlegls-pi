---
stage: "idea"
assignee: "agent"
author: "session:01a1c5bb-a391-74f0-bf18-04f956c1a35c"
---
While refining [[projects/concept/issues/reach-complete-5000-card-import-and-next-turn-after-residual-repairs]] on 2026-11-10, the managed `process` tool expanded `$PI_SESSION_ID` to empty in a tracker create command; tracker refused it with `author must be a nonempty provenance string`. The same thread's `bash` tool returned `PI_SESSION_ID=01a1c5bb-a391-74f0-bf18-04f956c1a35c`. A direct managed command, `printf 'PI_SESSION_ID=%s\nBB_THREAD_ID=%s\n' "$PI_SESSION_ID" "$BB_THREAD_ID"`, confirmed an empty PI_SESSION_ID while BB_THREAD_ID remained `thr_tz9durraem`.

Workaround: read the provenance from bash and supply its literal value to the managed tracker command; retry succeeded. The tracker recipe uses `$PI_SESSION_ID`, and tracker writes run through managed processes to accommodate hooks. Cause is unestablished. Related environment mismatch: [[projects/mlegls-pi/issues/managed-process-nested-shell-loses-mise-python-path]].
