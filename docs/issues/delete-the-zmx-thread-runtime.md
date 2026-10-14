---
stage: "ticket"
assignee: "agent"
author: "session:01a13a17-ba44-7373-87c5-ca7eff662862"
---
Make bb the only thread runtime and delete the zmx one, so workers and threads always run as bb threads.

Today `lib/thread` (`defaultRuntime` in `lib/thread/bb.ts`) picks bb when `BB_THREAD_ID` is set or `PI_THREAD_RUNTIME=bb`, else zmx (`docs/dispatch.md`, "A thread spawned from a session running inside bb"). Decided 2026-10-14: bb is the GUI, so the zmx runtime and its host admission (`sem` slot, memory gate in `lib/thread/admission.ts`) go.

Done:
- `lib/thread/zmx.ts`, `to-bb.ts` (the zmx→bb migration) and the zmx paths in `runtime.ts`, `lifecycle-cleanup.ts` and `launch.ts` are removed; `PI_THREAD_RUNTIME` is gone.
- The runtime is always bb, from inside a bb thread or from a plain terminal (the bb CLI reaches the daemon either way; verified 2026-10-14 with `BB_*` unset). Without `BB_THREAD_ID` the bb thread is top-level, which is fine: board reports and integration don't depend on bb nesting.
- When the bb daemon isn't reachable, spawning fails before creating a worktree with one clear error saying to start bb.
- A non-pi `launch.cmd` (`wm spawn --command`, `lib/wm.ts`) has no runtime left: reject it with a clear error and drop the option where nothing uses it.
- Host admission that only applied to zmx is removed, or kept only if bb threads use it; the reconciler budget and `maxConcurrent` remain the limits, as already documented for bb.
- zmx leaves `mise.toml`/setup if nothing else needs it.
- Docs say bb: `README.md`, `docs/dispatch.md` (zmx on PATH, runtime selection), `skills/enabled/pi/mlegls-pi/SKILL.md` and `skills/enabled/all/mlegls/orchestrations/multi-agent/SKILL.md` ("a worktree and a zmx session running pi"), and the supervision tool's description if it names zmx.
- Existing registered zmx threads: `ab thread ls` still lists or cleanly reports them so they can be abandoned; no migration needed.
- `bun run typecheck` and `bun test` pass; drive one dispatch + integrate through bb.

decisions:
- 2026-10-14: bb is the only runtime, also from plain terminals; no zmx fallback; non-pi worker commands are dropped.

Drive evidence (pending review, not completion): [bb-only encounter](../attachments/delete-the-zmx-thread-runtime/index.md).
