---
stage: spec
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/dsh-port]]"
blocked-by: ["[[projects/mlegls-pi/issues/dsh-board-host]]"]
---

Templated spawning and auto-dispatch in dsh. Presets (tool/prompt/skill set, model, effort) are declared through `agent-preset-registry`. Children run through `tool-subagent` in `continuable` mode (durable children, `send_message`, settlement notices, `maxDepth`), with `parentSession` / `delegationDepth` headers as the supervision tree. `lib/route.ts` + `lib/dispatch.ts` become a small routing plugin that picks the preset and model for an assignment, reusing the routing table (`routing.md`).

- Fork/join over the board: each child reports to its topic and the parent waits on it, with monitor events from [[projects/mlegls-pi/issues/dsh-board-host]] covering crashes.
- Concurrency limits are an admission policy on spawn, not a separate primitive.
- Under PTC a wave is `await Promise.all(assignments.map(dispatch))`; waiting, verifying and re-dispatching are code, not a sequence of turns. Check that dispatch returns a handle immediately and delivers the result by notice (`jobs`), so a long wave doesn't pin one `run_code`.
- Worktree isolation: in-process children share the host. For now each writing child gets a worktree through a preset hook or runs through `subagent-acp` for process isolation; the lasting model is [[projects/mlegls-pi/issues/project-scoped-sessions-and-worktrees]].

Done when a preset-routed child spawns from a program, reports through the board, and the parent is woken with its result; and a crashed child surfaces as a monitor event.
