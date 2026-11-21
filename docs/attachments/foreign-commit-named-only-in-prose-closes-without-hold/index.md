# Foreign commit completion hold

## Prediction before first use

As the local reconcile owner, I expect to start with a fix present only in the worker’s linked worktree of a loaded plugin repository. With no structured commit declaration, I expect the run to remain open and identify the missing commit at completion. Once the loaded checkout contains that commit, I expect reconciliation to close the issue.

## Drive

At `a4077dca`, ran `bun docs/attachments/foreign-commit-named-only-in-prose-closes-without-hold/replay.ts`. The replay drives the real reconciler with fake BB and disposable Git repositories; no credentials or live plugin installation are needed.

1. The replay reported the implementer ready, then seeded commit `1a988bc5` in the plugin’s linked worktree under the implementer’s `.wm/`. The scenario has no structured commit declaration.
2. The implementer retired and its nested worktree disappeared. After local landing, the issue was still at `ticket`. The hold named `1a988bc5` and the loaded checkout, and said to land the reviewed commit there before closing. **Hold prediction met**, even after worker retirement.
3. The replay fast-forwarded the loaded checkout. The issue and reconciler then both reported `done`. **Closure prediction met**. The replay exited successfully and removed its disposable root.

## Frictions and replay check

No friction observed through the supplied CLI entry point. To replay, run the command above and check for `ticket` with a hold naming the seeded SHA after local landing, followed by `done` only after fast-forwarding the loaded checkout. A successful exit alone does not describe those two observable states.

## Review

The baseline replay again held at `ticket` for `51e05c6b` until fast-forward. The completion, stop, and closed-chain checks passed (6/6).

With `--remove-before-report`, the worker runs `git worktree remove` on its clean foreign worktree before reporting, leaving `plugin-fix` intact. With this single change, `91ffeac4` remained outside the loaded checkout, but the replay printed `After local landing: done — done`. The scanner in `lib/reconcile/foreign-work.ts` enumerates registered worktrees and reads their HEAD reflogs. Git removes both the registration and that log during normal worktree removal. The surviving branch identifies the commit but no longer identifies the worker that made it.
