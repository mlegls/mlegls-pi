---
stage: "idea"
author: "session:9b877253-edb5-49b9-963e-dfbf6658a23a"
---
During first-use verification of move-coordination-off-the-board at eebff096, the documented CLI was discoverable in docs/dispatch.md, but `bun lib/reconcile/main.ts --help` exited 1 with ERR_PARSE_ARGS_UNKNOWN_OPTION and an internal stack trace. Running with no arguments printed usable syntax (exit 2), which is the workaround. Expected help should expose supported commands without a stack trace. No runtime operations were started. Evidence: docs/attachments/move-coordination-off-the-board/index.md on the verification branch.
