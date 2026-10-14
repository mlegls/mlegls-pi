---
stage: "ticket"
assignee: "agent"
author: "session:01a13a17-ba44-7373-87c5-ca7eff662862"
blocked-by:
  - "[[projects/mlegls-pi/issues/delete-the-threads-gui-and-tree-sidebar]]"
---
Make bb the only thread runtime and delete the zmx one, so workers and threads always run as bb threads.

Today `lib/thread` picks bb when `BB_THREAD_ID` is set or `PI_THREAD_RUNTIME=bb`, else zmx (`docs/dispatch.md`, "A thread spawned from a session running inside bb"). Decided 2026-10-14: bb is the GUI, so the zmx runtime and its host admission (`sem` slot, memory gate in `lib/thread/admission.ts`) go.

Done:
- `lib/thread/zmx.ts`, `to-bb.ts` (the zmx→bb migration) and the zmx paths in `runtime.ts`, `lifecycle-cleanup.ts` and `launch.ts` are removed; `PI_THREAD_RUNTIME` is gone.
- Spawning a thread or worker outside bb (no reachable bb) fails with one clear error naming bb, before creating a worktree.
- Host admission that only applied to zmx is removed, or kept only if bb threads use it; the reconciler budget and `maxConcurrent` remain the limits, as already documented for bb.
- zmx leaves `mise.toml`/setup if nothing else needs it.
- Docs say bb: `README.md`, `docs/dispatch.md` (zmx on PATH, runtime selection), `skills/enabled/pi/mlegls-pi/SKILL.md` and `skills/enabled/all/mlegls/orchestrations/multi-agent/SKILL.md` ("a worktree and a zmx session running pi"), and the supervision tool's description if it names zmx.
- Existing registered zmx threads: `ab thread ls` still lists or cleanly reports them so they can be abandoned; no migration needed.
- `bun run typecheck` and `bun test` pass; drive one dispatch + integrate through bb.
