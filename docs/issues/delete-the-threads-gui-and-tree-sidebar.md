---
stage: "done"
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

## Result

done — The deletion holds on my final head, and I repaired one defect the driver and implementer missed. `bun run typecheck` passes and `bun test` gives 225 pass, 2 skip, 0 fail.

- **Fixture repair:** `docs/attachments/worker-admission/fixture.ts` no longer parsed after the tree removal. The `else throw` branch was cut along with the tree actions, which left an unclosed block. Typecheck doesn't cover that file. I restored the unknown-action error and removed the `tree`/`tree-list` lines from `docs/attachments/worker-admission/index.md`. `bun build` of the fixture now succeeds, but I didn't run its actions. Fix commit is `4f804ef6`.
- **Dangling link:** The vault in the main checkout still has `guide/work-in-threads.md` and `stories/work-in-threads.md` until this branch merges. One live issue, `forked-thread-retains-parent-board-subscriptions`, linked the retired story. I pointed it at `issues/archive/threads-on-zmx-with-a-native-sidebar` in a tracker commit on main, `bc5a083e`. The other references are in archived issues and attachments, which stay as is.
- **Friction issues:** The driver filed none. `cua-safari-background-type-changes-frontmost` came in through the merge from another session. It names an owner and an open investigation, so I left it as an idea.
- **Review notes:** I appended the review to the driver's packet in `docs/attachments/delete-the-threads-gui-and-tree-sidebar/index.md`. No shots, because the journey is nonvisual.

```yaml
commit: 70a880ea (branch head); repairs 4f804ef6; tracker link repair bc5a083e on main
stories:
  - story: Removed tree GUI entry point
    outcome: held
  - story: ab thread listing remains usable
    outcome: held
  - story: User-facing documentation no longer directs users to Threads/sidebar
    outcome: held
evidence:
  path: docs/attachments/delete-the-threads-gui-and-tree-sidebar/index.md
  visual: false
  shots: []
tests: []
fixed:
  - worker-admission fixture syntax error and stale tree index lines (4f804ef6)
  - forked-thread-retains-parent-board-subscriptions link to the retired story (bc5a083e)
caveats:
  - The graph tests in the deleted lib/tree/tree.test.ts went with it, as the ticket directs. lib/graph.ts is now covered only indirectly through the profile and context consumers.
```

Evidence: [docs/attachments/delete-the-threads-gui-and-tree-sidebar/index.md](docs/attachments/delete-the-threads-gui-and-tree-sidebar/index.md)
