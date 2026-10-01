---
stage: done
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/archive/dsh-port]]"
---

Templated spawning and auto-dispatch in dsh. Presets (tool/prompt/skill set, model, effort) are declared through `agent-preset-registry`. Children run through `tool-subagent` in `continuable` mode (durable children, `send_message`, settlement notices, `maxDepth`), with `parentSession` / `delegationDepth` headers as the supervision tree. `lib/route.ts` + `lib/dispatch.ts` become a small routing plugin that picks the preset and model for an assignment, reusing the routing table (`routing.md`).

- Fork/join over the board: each child reports to its topic and the parent waits on it, with monitor events from [[projects/mlegls-pi/issues/archive/dsh-board-host]] covering crashes.
- Concurrency limits are an admission policy on spawn, not a separate primitive.
- Under PTC a wave is `await Promise.all(assignments.map(dispatch))`; waiting, verifying and re-dispatching are code, not a sequence of turns. Check that dispatch returns a handle immediately and delivers the result by notice (`jobs`), so a long wave doesn't pin one `run_code`.
- Worktree isolation: in-process children share the host. For now each writing child gets a worktree through a preset hook or runs through `subagent-acp` for process isolation; the lasting model is [[projects/mlegls-pi/issues/project-scoped-sessions-and-worktrees]].

Done when a preset-routed child spawns from a program, reports through the board, and the parent is woken with its result; and a crashed child surfaces as a monitor event.

## Result

`run_code → dispatch → lib/route.prepare → preset + continuable child → board/settlement notice`.

The optional `dsh/dispatch.yml` declares research/fill capability and routing defaults. Writing children receive retained Git worktrees; upstream admission, depth, lineage and settlement remain in charge. `lib/dispatch.ts`'s wm backend is unchanged. Setup and the opt-in persistent-host probe are in `dsh/dispatch/README.md` and `dsh/dispatch/verification/README.md`.

### Evidence

**Before:** continuable provider preparation could not choose cwd/preset; the headless host also exited before an unfinished child settled.

**After:** the [implementation self-check](../../dsh/dispatch/verification/first-use.md) launched a three-child PTC wave, returned handles while the parent was idle, observed an idle-parent wake and board readback, exercised read-only tools and writer shell cwd, and observed a failed child's crashed/error-turn-end/exited records. Existing route/dispatch tests (9) and board test (1), build, frozen install and focused strict typecheck pass. Independent acceptance remains with [[projects/mlegls-pi/issues/archive/dsh-port]].

**Independent drive:** [session packet](../attachments/dsh-templated-spawn-and-dispatch/index.md) and executable black-box assertion `dsh/dispatch/verification/dispatch-story.test.ts`.

### Danger

**Door:** two-way. Overlay is opt-in; successful child worktrees persist until parent retirement.

**Blast radius:** dsh. The pinned subagent package patch changes continuation creation/resume; children share the host, so process-death isolation remains with [[projects/mlegls-pi/issues/project-scoped-sessions-and-worktrees]]. The optional router preference argument leaves existing pi callers unchanged.

Frictions: [[projects/mlegls-pi/issues/archive/dsh-continuable-child-preset-and-workspace-seam]], [[projects/mlegls-pi/issues/archive/dsh-headless-exits-before-continuable-children-settle]], [[projects/mlegls-pi/issues/archive/dsh-schema-optional-array-materializes-empty-allowlist]], [[projects/mlegls-pi/issues/archive/dsh-preset-relative-plugin-loading]], [[projects/mlegls-pi/issues/archive/supervised-workers-cannot-read-peer-board-from-bash]].

The read-only tool allowlist is not a filesystem security boundary; inherited PTC Node access is tracked in [[projects/mlegls-pi/issues/archive/dsh-read-only-preset-does-not-constrain-ptc-node-access]].

## Verification evidence

[Encounter and evidence](../attachments/dsh-templated-spawn-and-dispatch/index.md).

Unisolated paths are tracked in
[[projects/mlegls-pi/issues/archive/dsh-dispatch-unexercised-admission-and-resume]].
