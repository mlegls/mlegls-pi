---
stage: "ticket"
assignee: "agent"
author: "session:01a13a17-ba44-7373-87c5-ca7eff662862"
---
Delete the Threads GUI and the Ghostty tree sidebar; bb is the GUI (decided 2026-10-14, see [[projects/mlegls-pi/issues/archive/threads-on-zmx-with-a-native-sidebar]]).

Done:
- `apps/threads/` (the native AppKit app, vendored DisplayLink included) is gone.
- `lib/tree` keeps only what non-GUI code uses: `graph.ts` (imported by `lib/profile.ts`) and whatever it needs. `ui.ts`, `app.ts`, `ghostty.ts`, `actions.ts`, `view.ts`, `workspaces.ts`, `files.ts`, `tail.ts`, `cli.ts` and their tests go unless something outside `lib/tree` still imports them; if `graph.ts` is all that's left, move it next to its consumer.
- `bin/ab` drops the `tree` branches (including the `--sidebar` restart loop); `ab thread` still works.
- `docs/attachments/worker-admission/fixture.ts` loses its `tree`/`tree-list` actions (use `ab thread ls` instead if it needs a listing).
- `docs/guide/work-in-threads.md` and `docs/stories/work-in-threads.md` describe only the Threads app/sidebar: delete them, and remove or repoint links to them (tracker `check` must not gain dangling links outside `archive/` and attachments of archived issues; leave archived evidence as is).
- README's `lib/tree` line and `docs/dispatch.md`'s mentions of "the sidebar and Threads" are updated.
- `bun run typecheck` and `bun test` pass.

Not in scope: the zmx thread runtime ([[projects/mlegls-pi/issues/delete-the-zmx-thread-runtime]]).
