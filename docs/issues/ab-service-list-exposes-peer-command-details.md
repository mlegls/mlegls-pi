---
stage: idea
author: "session:01a0ee77-7c25-77da-8e74-7eafaff19b91"
---

During first-use preparation for [[projects/concept/attachments/welcome-a-new-account-with-getting-started-on-me/index]] while implementing [[projects/concept/issues/advance-getting-starteds-counter-from-feature-use-receipts]], a complete `ab service list` included peer-worktree services with their command details. Inspecting this worktree's owned services does not require exposing unrelated workers' commands.

The safe workaround is to filter records to this checkout's exact `cwd` and project out command fields. In this session, the filtered view emitted only IDs, cwd, log paths, timestamps and status. No peer service was used.

The owning tool is `ab` in mlegls-pi. Consider making the safe, worktree-scoped view the default, with command details opt-in.
