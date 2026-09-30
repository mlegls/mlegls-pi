---
stage: idea
author: session:01a0f0ef-82cc-77b7-a238-d9197ad442be
---

During [[projects/mlegls-pi/issues/archive/native-computer-lacks-a-manual-llm-path]] first use, `cua-driver launch_app` with `creates_new_application_instance:true` and a worktree-owned scratch text file returned a fresh TextEdit PID, but that process also restored `Untitled 2` and the implementer's earlier scratch document. A new process therefore did not imply exclusively worker-owned document state. After closing the worker's exact scratch window, those restored windows remained; the worker left the process open rather than closing documents whose ownership was unclear.

Owner: native verification setup guidance in mlegls-pi; observed platform behavior is macOS TextEdit state restoration via CuaDriver 0.30.4, not an established driver defect. No upstream software change is requested by this observation.

Tried: new app instance plus a unique scratch URL. Observed: distinct PID 24702, intended window 16011, additional restored windows 16009/16010. Workaround: select only the exact scratch window for input and close it via its fresh AX button token; leave restored documents untouched. [Drive evidence](../attachments/native-computer-lacks-a-manual-llm-path/index.md).

Possible improvement: documented setup that avoids restored documents, or a cleanup rule distinguishing restored state from newly created state. Investigate before prescribing launch flags or discarding restored documents.
