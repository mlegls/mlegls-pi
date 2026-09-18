---
next: implement
part-of: "[[projects/mlegls-pi/issues/skills-triage]]"
---

a worker that starts with this session's transcript. `wm.spawn({fork: true, ...})` runs the agent as `pi --fork $PI_SESSION_ID` (the agent file's `runCommand` with `--fork` added; `PI_SESSION_ID` is already in the worker env). done when `advance` can be run as a forked child from an interactive session, its turns watched from the parent, and the parent can jump to where it ended.

where this came from: deciding what a "script" is mid-session. a procedure needing the model's judgment could return control to the session (generator + resume protocol), or fork the session and run as a worker whose prefix is identical to the parent's. the fork costs the same (shared prompt-cache prefix), expresses strictly more (the parent may continue meanwhile), and needs no resumption protocol; the child's session file *is* the continuation. this also closes the ask-fallback hole in "[[projects/mlegls-pi/issues/archive/decide-primitive]]": neither suspend nor re-run; the child blocks on `needs-input` like any worker.

shape:
- `lib/wm.ts` `SpawnOptions.fork?: boolean`; when set, the run command gets `--fork $PI_SESSION_ID`. a worktree is still made (workmux's unit); read-only procedures just don't commit.
- jump: a `/jump <handle>` (or `wm.jump`) in `extensions/session` that switches the parent to the child's session file. the child's file contains the parent's history as its prefix, so switching is the append.
- preview: `wm.capture(handle)` on an interval into a widget in the parent UI. optional; the workmux dashboard and `cmux_open_terminal` on the worker's pane cover it until then.

decisions:
- 2026-09-18: no prototype; iterate in real use.
