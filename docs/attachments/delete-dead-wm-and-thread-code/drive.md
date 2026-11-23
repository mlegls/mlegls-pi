# Independent retirement drive

## Predictions before use

- The offline entry point will prepare two workers; a merged worker retired by receipt will archive its thread, remove its linked worktree, and report only branch deletion.
- An unmerged worker retired by bare handle will archive its thread and remove its linked worktree while keeping the branch with an explanation. Each retirement will take one thread-list call.
- The project view used by `orient` will still print. Whether the removed internals have callers is a review question; no public interaction can establish the absence of imports.
- Explicit keep-branch should report only retention. The documented offline entry describes merged and unmerged cases; it does not promise an explicit keep-branch case.

## Observed at `583ea155`

Ran `bun docs/attachments/delete-dead-wm-and-thread-code/first-use.ts` with Bun, Git, mise and lsof on PATH. No credentials or live BB daemon were needed. The disposable setup reported two linked worktrees ready, one containing an unmerged commit.

| Action | Observation | Expectation |
| --- | --- | --- |
| Retire merged worker by receipt | One thread-list call. Archived, worktree and branch absent. `branchDeleted: merged`; retention list empty. | Met |
| Retire unmerged worker by bare handle | One thread-list call. Archived, worktree absent, branch present. `branchKept: "unmerged: not merged into main"`; deletion list empty. | Met |
| Run `bun lib/views.ts` | Printed checkout, Git, worktrees, tracker and outline sections. | Met |
| Request explicit retention of a merged branch | The supplied entry point offered only the two default paths above. | Unobserved |

## Friction and replay checks

The documented entry point is enough to compare default deletion and retention, but cannot witness the explicit keep-branch case named in the ticket. Replay the command above and compare both receipts against the table. For review, prepare a merged worker in disposable BB/Git state, retire with explicit retention, and require one list call, archived thread, absent linked worktree, present branch, a retention reason, and no deletion receipt. Separately verify the zero-caller claim across the package, BB plugins and skills scripts; CLI output does not establish that property.

