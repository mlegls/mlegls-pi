# Prepared dispatch

The parent owns decomposition, dependencies, stance choice, concurrency and acceptance. `tools.dispatch` launches prepared assignments as BB threads in isolated worktrees; each reports by ending its turn.

```js
const wave = await tools.dispatch({ run: "feature-x", maxConcurrent: 2, active: [], assignments: [
  { handle: "unit-a", prompt: "Self-contained assignment, context, constraints and completion criterion",
    agent: "auto", base: "<exact Git ref>" },
] });
```

Serialize waves and pass **all outstanding** handles in `active` across waves (`maxConcurrent` defaults to 8). Excess assignments return as `pending`.

Each assignment takes `handle`, a self-contained `prompt`, and either `agent` (a stance in `agents/`, routed per [routing.md](../routing.md)) or exact `model` (`provider/model`) and `effort`. Optional `base` pins the Git ref; omitting it uses the checkout's HEAD (never uncommitted changes). The entire wave validates before the first launch, including issue/assignee rules below.

The receipt returns:

- `submitted`: `{handle, run, path}` per launch; `<run>/<handle>` names the worker.
- `failed`: first failed assignment and error. Earlier launches survive; inspect any created worktree before retrying.
- `pending`: assignments skipped due to capacity or an earlier failure.

## BB runtime

Every worker is a BB thread nested under its parent (or top-level from a terminal); the BB daemon must be running. Worker metadata lives only in the BB thread (title `<run>/<handle>`, environment = worktree) and git config; reports come from the turn's final message (`lib/thread/turn.ts`, `lib/thread/bb.ts`).

`mise run setup` runs before BB starts the provider. On failure, `.wm/setup.log` is copied to `<git-common-dir>/reconcile/setup-failures/` before cleanup (if copying fails, the worktree stays). On success, `.wm/setup.log` and `.wm/setup.json` remain in the worktree.

The BB supervision plugin seeds worker identity and forwards it to the provider (`provider.env-resolved` in `bb thread log --json`). Keep `BB_PI_BRIDGE_COMMAND` pointed at `bin/bb-pi` so auxiliary Pi processes drop worker identity and receive the personal system prompt. Start BB from a clean environment so unrelated threads don't inherit worker env vars.

## Supervision

Workers report by ending their turn with `done`, `blocked`, `needs-input` or `checkpoint` as the first word (`lib/report.ts`). BB notifies the parent when a child finishes. Answer or steer a worker with `bb thread tell <thread> --mode queue`. A finished turn only hands control back—check the report and acceptance criterion before integrating.

## Integration

Once a worker is settled and accepted, `tools.integrate({worker, mode?, keep?})` merges via plain Git and refuses uncommitted changes. Default `mode: "rebase"` rebases onto parent HEAD and fast-forwards; `mode: "merge"` creates a `--no-ff` merge commit. Conflicts abort with `{conflict: true, branch, files}` so the worker can resolve them on its branch.

Before merging, integration replays destination commit hooks on every incoming commit. Hook failures return the commit and queue the output to the worker; amend or rewrite the rejected commit rather than stacking a fix on top.

Unless `keep: true`, cleanup runs **after** integration: removes the BB thread and worktree, sends SIGTERM to leftover processes rooted in the worktree (`killed`), and deletes the branch when `git cherry` confirms all patches are in HEAD (`branchDeleted`; otherwise kept with `branchKept`). `tools.retire({worker})` runs the same cleanup without merging, preserving unmerged branches. Cleanup is sequential—if it fails after a merge, the merge stands; inspect before retrying.

## Reconciler landings

`reconcile` captures `land` (`local`, `pr-merge`, or `pr-review`) from its argument, the owner's committed `.pi/reconcile.json`, or `local`. Resume keeps the saved mode and refuses a conflicting override. The owner is the BB thread notified of exceptions and completion (falling back to the `supervisor` role holder in `desk/ROLES.md` if closed).

- `local`: lands directly into the owner checkout.
- `pr-merge` / `pr-review`: stages into a deterministic run-owned branch/worktree off the fetched default base, opens a PR, retires ordinary workers while polling (~1/min), merges base/contributor updates without rewriting history, and repairs CI/review failures within a bounded budget (2 repair workers, 3 integration attempts). Only `MERGED` + fetched base ancestry closes issues (child-first) and best-effort fast-forwards a clean owner checkout on the base branch. See [reconcile-pull-requests.md](guide/reconcile-pull-requests.md).

## Stance models

`stance/<agent>` is a Pi virtual model (`extensions/stances`). Each new user turn routes to the first entry in the agent's `model:` list with credentials and delegated capacity left; continuations stick to it for prompt-cache reuse, stepping down the list on rate-limit or overload errors.

`allocation.json` maps each provider to its `quota-axi` provider and the share delegated work may consume. Delegated work may use a provider while every applicable window has more than `(1 - share) × timeRemainingPercent` remaining; unmapped or unreadable providers aren't gated. For `codex` quota, banked reset credits (`GET https://chatgpt.com/backend-api/wham/rate-limit-reset-credits` using `~/.codex/auth.json`) count as extra full windows. When a bounding window hits 0% with delegated work waiting, the router redeems the earliest-expiring credit once per window (claimed under `$XDG_STATE_HOME/mlegls-pi/codex-resets/`), logs it and sends a `bb push-notifications send`. Interactive work at 0% falls back without redeeming.

## Tracker assignment

Pass each issue's own `issue` and `assignee` into its assignment (omitting `assignee` refuses automatic dispatch; parent selectors aren't inherited across decomposition):

- `agent`: any stance.
- `agent:technical`: specific stance.
- `model:zai/glm-5.3-flash:high`: exact model and effort.
- `agent:technical, model:zai/glm-5.3-flash:high`: both (either order).
- `human`, `user:<name>`, `session:<id>`: never auto-dispatched.
