---
stage: idea
assignee: agent
author: session:01a0f75a-a8f9-713c-ab66-9c81d8f04a29
---

During [[projects/mlegls-pi/issues/thread-cli-over-registry]] CLI first use, `./bin/ab tree --help` exited 1 with a Bun `ERR_PARSE_ARGS_UNKNOWN_OPTION` stack trace instead of command usage. `./bin/ab thread --help` printed usage. This made discovering the unchanged tree's non-UI route uncertain; running `./bin/ab tree` in the owned fixture worked and opened no UI.

Observation belongs to mlegls-pi's existing tree CLI, not the new thread routing. Consider accepting help before option validation. [Encounter](../attachments/thread-cli-over-registry/index.md).
