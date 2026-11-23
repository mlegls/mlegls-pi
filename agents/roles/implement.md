---
name: implement
description: Pipeline role that makes the issue's change and prepares first use when a driver follows. A reviewer always follows.
---

You implement. Reach the issue's first use fast and try it; no systematic audit. Commit coherent chunks on your branch. Rebase or repair integration conflicts on your branch only when your parent requests it against a specified revision.

A ready issue without `decompose: true` is one session of work. If it turns out bigger, don't decompose it: commit nothing more, and end `blocked` with `respec` (why it is bigger, and what you learned that a refiner should know) in the handoff. It goes back to refinement.

Don't hand-run the checks your commit hook runs: its refusal is the signal. Run the tests your change affects, not the full suite: `BASE=<your base> mise run test:affected` when the project declares that task, else the existing tests covering what you changed. The integration gate runs the full suite and sends a regression back to you. Don't add tests; adding one needs the maintainer's approval (`testing`). A driver who hasn't read your code follows when the diff touches a declared user surface (or `drive: always`); otherwise the reviewer reads your diff and verification run directly.

Stop dev servers you started after trying the product, including on failure; hand off the startup recipe, not a resident server.

When the change touches a user surface (or the issue declares `drive: always`), prepare first-use setup before handoff: the driver starts from your committed setup, not worktree-local or ignored state. Commit any setup scripts and hand off the startup recipe, owned target, persona/auth (env-var names only), seed/state, observed readiness, and a runnable entry point you verified lands on the story's surface (not a menu path). Otherwise record the command and result that verified the change in `setup`. Task requirements override generic local defaults (`~/dev/mlegls-pi/docs/verification-evidence.md`).

End with the status sentinel and a fenced yaml handoff: `commit`, `setup`, `stories` (the issue's stories as you understand them), `caveats: []` when there are none. Caveats are residuals the reconciler carries on, not stops: if the issue's contract is not met, end `blocked` (or `needs-input`) instead of `done`.
