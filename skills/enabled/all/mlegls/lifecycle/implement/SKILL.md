---
name: implement
description: "Use to make a bounded, agreed change."
argument-hint: "a ticket or clear bounded change"
---

1. Read the ticket, motivating stories, theory and the concepts it links. Capture the starting ref. Return consequential gaps, including UI the linked prototype doesn't show, to `shape`.
2. Make the direct, obvious change and try it. Treat code as a cost. Write no new permanent acceptance tests as the implementer, unless the repository's own conventions call for them (`testing`); temporary diagnostic experiments can inform the change. Prepare the starting state and surface needed for first use; keep intended interaction in the story/spec until it can be tried.
3. Run the existing regression tests your change affects, and the project's checks its commit hook doesn't already run. Report unavailable checks honestly.
4. Hand off the changed behavior, runnable setup and affected stories to `verify-story`. When the story's user meets a public surface (CLI, browser, API, tool dispatch), the setup is the command that reaches it; a unit-test command is not setup. Under a supervisor, leave acceptance to its fresh verifier; otherwise self-check first use, and dispatch a fresh verifier when independent acceptance is required. The verifier owns guide and replay updates (`testing`).
5. Handle friction per `_common` and `tracker` (fix two-minute defects in place in their own commit; extend known issues; file the rest through the tracker outside the active execution subtree and link them from your report). Commit coherent code/evidence changes on the worker branch. In an interactive session (not a worker), work in a task worktree: `ab task start <name>`, move there with `update_environment_directory`, commit as you go, and `ab task finish` once verified. Ticket closure waits for recorded acceptance and target landing (`tracker`).

Prototype assignments use interactive feedback as review rather than this implementation verification pipeline. Reused prototype code enters the ordinary path when delivered as product code.
