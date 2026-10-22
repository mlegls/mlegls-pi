# Task worktree first use — 2026-10-22

Live bb, after integration (bb's pi loads the canonical package, so this ran the integrated `extensions/task/` and `lib/task.ts`). Disposable repository `/tmp/task-firstuse/repo` as bb project `task-firstuse` (proj_pjwv52u5pw); ordinary pi threads in its Project checkout environment.

Another task's state in the shared checkout before and after everything: ` M notes.txt` (unstaged edit) and `A  staged-by-other.txt` (staged new file). Unchanged throughout.

## Ordinary edit request — @thread:thr_su2yhdtk3r

Prompt: "Change greeting.txt in this repository to say "hello, task" instead of "hello". Commit your change and get it onto main when it is done; leave everything else alone."

From the thread's session (tool calls):
1. Read the `implement` skill, which now names the task route; ran `ab task start greeting-task` → `/private/tmp/task-firstuse/repo__worktrees/greeting-task`, branch greeting-task, target main, "setup: none declared"; a `[task] Continue …` message was queued to the thread.
2. `update_environment_directory` to the worktree; ended its turn. The queued message started the next turn without anyone typing.
3. Next turn: `pwd` = the worktree; edited greeting.txt; committed c47afb7; `ab task finish` → fast-forward 11bc0b7..c47afb7 on main; reaper started.
4. Checked the checkout (` M notes.txt`, `A  staged-by-other.txt`, head c47afb7) and moved back with `update_environment_directory`.

bb environments for the project afterwards: the worktree's env_vzq7e6sbt7 had `mergeBaseBranch: main` (set by the extension's session start); the thread's environment was the checkout again.

Cleanup: the reaper waited while the thread's idle pi and bb's bridge still had their cwd in the worktree. After the thread's next turn (a `pwd` question, answered from `/private/tmp/task-firstuse/repo`), the reaper logged `{"removed":true,"branch":"deleted","kept":null,"environment":"env_vzq7e6sbt7"}`; `git worktree list` shows only the checkout.

## Refusal — @thread:thr_z674n8rwba

Prompt: use the write tool to create probe.txt in the checkout; if refused, reply with the refusal and stop. Reply (verbatim refusal): "Independent edits go in a task worktree, not the shared checkout /private/tmp/task-firstuse/repo. Run `ab task start <short-task-name>` in bash from /private/tmp/task-firstuse/repo, call update_environment_directory with the path it prints, and end your turn: a queued message resumes you there. Commit coherent changes as you go; finish with `ab task finish`. Nothing you haven't committed moves; don't take other sessions' changes. (The user can allow edits here with /edit-here.)" No probe.txt was written.

## Dogfood

This session's own bb-managed worktree branch was integrated into mlegls-pi main with `bun lib/task.ts finish --into main` (rebase + fast-forward f3807a6e..92790212, canonical checkout clean before and after).

## Tests

`lib/task.test.ts`: guard path rules, extension wiring and /edit-here, concurrent finishes serialized into main with another session's dirty and staged files intact, uncommitted refusal, reaping, bb-managed `--into`. `heavy bun test lib/thread/ lib/dispatch.test.ts`: 20 pass after the integrateCheckout refactor. Full `mise run test`: 232 pass, 1 fail (pickup scan test timed out at 5 s under the queue; timeout raised, passes).

## Retained limits

- Cleanup completes only once bb moves the thread's pi out, i.e. at the thread's next turn (or when bb releases the idle pi); the reaper waits up to 6 h, then leaves the worktree and logs why in `<git-common-dir>/ab-task/<branch>.log`.
- `/tmp` vs `/private/tmp`: moving back created a second checkout environment row for the realpath (cosmetic; real projects under ~/dev aren't symlinked).
- Shell-made edits in the checkout aren't refused; the guard sees edit/write only.
- In this run the agent took the task route from the updated `implement` skill before any refusal; the refusal was exercised separately.
