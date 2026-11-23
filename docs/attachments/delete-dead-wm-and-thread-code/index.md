# Worker retirement first use

From the package checkout, run `bun docs/attachments/delete-dead-wm-and-thread-code/first-use.ts` with Git, mise, and lsof on PATH. The script starts no daemon or provider. It creates a disposable repository, dispatches two workers through a fake BB CLI, commits an unmerged patch on one, and removes the fixture on exit.

Observed both workers ready on their linked worktrees before retirement:

| Selector | `thread list` calls | Thread archived | Worktree remains | Branch receipt |
| --- | ---: | --- | --- | --- |
| Receipt, merged | 1 | yes | no | `branchDeleted: merged`; `branchesKept: []` |
| Bare handle, unmerged | 1 | yes | no | `branchKept: "unmerged: not merged into main"`; `branchesDeleted: []` |

`bun lib/views.ts` still prints the project views used by `orient`.
