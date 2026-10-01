# Prepared dispatch

The parent owns decomposition, dependencies, stance choice, concurrency and acceptance. `tools.dispatch` only launches prepared assignments, each as a `wm` worker: a workmux worktree and tmux window running pi, reporting on board topic `<run>/<handle>`.

```js
const wave = await tools.dispatch({ run: "feature-x", maxConcurrent: 2, active: [], assignments: [
  { handle: "unit-a", prompt: "Self-contained assignment, context, constraints and completion criterion",
    agent: "auto", base: "<exact Git ref>" },
] });
store("wave", wave);
```

Serialize submissions and pass **all outstanding** handles in `active`, across waves. `maxConcurrent` (default 8) is a parent-scoped budget, not a daemon-wide limit or queue. Excess assignments remain `pending`.

Assignments require `handle`, a self-contained `prompt`, and either `agent` (a roster stance in `agents/`; its execution is the `stance/<agent>` virtual model) or an exact `model` (`provider/model`) and `effort`. Optional `base` passes the exact Git ref; omission uses the host default, not uncommitted parent changes. The entire wave is validated before the first launch, including issue/assignee constraints below. No implicit retries, dependency scheduling, or inherited issue ownership.

The receipt contains:

- `submitted`: `{handle, run, path}` per launch, plain data you can persist; `<run>/<handle>` is its board topic.
- `failed`: first failed assignment and error text. Earlier launches survive. Inspect the worktree workmux may have created before deciding what to do.
- `pending`: assignments never attempted, because of capacity or the earlier failure.

## Supervision

Workers report by ending their turn: the last message starts with `done`, `blocked`, `needs-input` or `checkpoint` (`lib/report.ts`), posted on `<run>/<handle>`. Dispatch subscribes the parent to `<run>/**` with wake, so reports start its next turn. `tools.mail({to: "<run>/<handle>", body})` answers a question or steers a worker. A completed turn is not assignment completion: read the report, answer questions, and check the assignment criterion.

For peer coordination, read `tools.board_read({ topic: "<run>/**" })` without a tag filter so decisions aren't excluded. `<run>/**` includes the base topic and all descendants (including nested runs); `<run>/*` misses decisions posted on the base topic.

## Integration

After the worker is settled and completion is accepted, `tools.integrate({worker, mode?, keep?})` uses plain Git. It refuses uncommitted worker changes. Default `mode: "rebase"` rebases onto parent HEAD and fast-forwards; `mode: "merge"` makes a `--no-ff` merge commit. Conflicts abort and return `{conflict: true, branch, files}`; send those to the worker to resolve on its branch. The caller owns settlement and acceptance; integration does not infer them from idle status.

`keep: true` stops after Git integration. Otherwise cleanup happens **after** integration: workmux removes the worker's window and worktree. Processes still running from inside the worktree (a dev server, a watcher) are sent SIGTERM (`killed`); workmux doesn't reach them. Then the worker's branch is deleted when all its patches are in HEAD (`git cherry`, since rebasing rewrites commits; `branchDeleted`); if it is unmerged or still checked out, it is kept and the reason is in `branchKept`. `tools.retire({worker})` does the same cleanup without integrating, e.g. for dropped work, whose unmerged branch survives. Both take the receipt's handle or just its name, found under `<checkout>__worktrees/`. Cleanup is sequential, not transactional: if it fails after the merge, the merge remains. Inspect the worktree before repeating cleanup. Nothing is removed on merge failure.

## Stance models

`stance/<agent>` is a pi virtual model (`extensions/stances`) for each agent file with a `model:` list. Each new user turn goes to the first entry whose provider has credentials and delegated capacity left; continuations stay on it so prompt caches hold, and a retry after a rate-limit or overload error moves down the list. Model choice lives in each agent's `model:` list; the reasoning behind those lines is in `docs/models.md`, and the stances themselves are described in `routing.md`.

`allocation.json` maps each pi provider to its `quota-axi` provider and the share of each quota window delegated work may use. The rest is kept for interactive use over the time left in the window: delegated work may use a provider while every applicable window has more than `(1 - share) × timeRemainingPercent` left. Providers without an entry or readable windows aren't gated. An entry's `resets` lists the expiry of each banked full reset; each unexpired one counts as another full window. When delegated work is admitted only because of the bank, a desktop notification (once per provider and reset) asks you to redeem the earliest-expiring reset when the window runs out; remove it from the list once redeemed.

## Tracker assignment

Carry each issue's own `issue` and `assignee` into its assignment, even when the assignee is absent: an issue without one refuses automatic dispatch. Re-read child assignments during recursive decomposition: a parent's selector is not inherited permission.

- `agent`: any agent.
- `agent:fill`: that stance.
- `model:zai/glm-5.3-flash:high`: that exact model and effort.
- `agent:fill, model:zai/glm-5.3-flash:high`: both; component order is immaterial.
- `human`, `user:<name>`, `session:<id>`: never dispatched automatically. Hand to the human or resume the exact assigned session.
