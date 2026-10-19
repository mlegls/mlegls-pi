# Prepared dispatch

The parent owns decomposition, dependencies, stance choice, concurrency and acceptance. `tools.dispatch` only launches prepared assignments, each as a `wm` worker, a bb thread (a worktree and a pi run by bb), reporting by ending its turn.

```js
const wave = await tools.dispatch({ run: "feature-x", maxConcurrent: 2, active: [], assignments: [
  { handle: "unit-a", prompt: "Self-contained assignment, context, constraints and completion criterion",
    agent: "auto", base: "<exact Git ref>" },
] });
store("wave", wave);
```

Serialize submissions and pass **all outstanding** handles in `active`, across waves. `maxConcurrent` (default 8) is a parent-scoped budget. Excess assignments remain `pending`.

Assignments require `handle`, a self-contained `prompt`, and either `agent` (a roster stance in `agents/`; its execution is the `stance/<agent>` virtual model) or an exact `model` (`provider/model`) and `effort`. Optional `base` passes the exact Git ref; omission uses the host default, not uncommitted parent changes. The entire wave is validated before the first launch, including issue/assignee constraints below. No implicit retries, dependency scheduling, or inherited issue ownership.

The receipt contains:

- `submitted`: `{handle, run, path}` per launch, plain data you can persist; `<run>/<handle>` names the worker.
- `failed`: first failed assignment and error text. Earlier launches survive. Inspect the worktree the thread may have created before deciding what to do.
- `pending`: assignments never attempted, because of capacity or the earlier failure.

## bb runtime

Every worker and thread is a bb thread: [bb](https://github.com/get-bb/bb) runs its pi and shows it in its desktop, web and mobile apps, nested under the spawning session's bb thread when there is one (a spawn from a plain terminal makes a top-level bb thread; reports and integration don't depend on the nesting). The bb daemon must be running: the bb CLI reaches it from inside a bb thread or a plain terminal alike, and when it doesn't answer, spawning fails before creating a worktree, saying to start bb. The registry, worktree, setup and integration are ours; a worker's report is its bb thread's last message (`lib/thread/turn.ts`) (`lib/thread/bb.ts`). Setup (the project's `mise run setup`) runs before bb starts pi, and a failing worker setup fails the spawn with its log under the thread state directory. There is no host admission: the parent's `maxConcurrent` and the reconciler's budget are the only limits. A thread's state is bb's (`idle`, `working`, `exited` once archived), since bb may release an idle thread's pi; retiring stops and archives it in bb. Thread JSON also reports `workspace: {processes, rssMB}`: a census of processes whose cwd is in the owned worker worktree, including services left behind after pi exits. RSS is a rough sum; guest/shared-cwd processes are not attributed to a worker.

A worker's command is always pi: `wm.spawn` has no `command` option and `from: "fork"` is gone (bb threads can't fork a session); `from: "summary"` remains. Threads registered under the retired zmx runtime still list in `ab thread ls` (state `exited` unless their pi is still live); abandon them with `ab thread abandon <id>`.

bb gives every thread the same environment, so a worker's identity (run, handle, stance, checkpoint ratio) is written to `.wm/launch.env` in its worktree, and bb runs pi through `bin/bb-pi`, which sources it: set it once with `bb-app env set BB_PI_BRIDGE_COMMAND <this checkout>/bin/bb-pi`. Start bb from the Dock or with a clean environment: a bb started from a pi session's shell passes that session's `PI_WM_*` identity to every thread.

## Supervision

Workers report by ending their turn: the last message starts with `done`, `blocked`, `needs-input` or `checkpoint` (`lib/report.ts`). The workers are bb child threads of the parent, so bb tells the parent when each finishes. `bb thread tell <thread> --mode queue` answers a question or steers a worker; the reconciler does the same for its workers. A completed turn is not assignment completion: read the report, answer questions, and check the assignment criterion.

## Integration

After the worker is settled and completion is accepted, `tools.integrate({worker, mode?, keep?})` uses plain Git. It refuses uncommitted worker changes. Default `mode: "rebase"` rebases onto parent HEAD and fast-forwards; `mode: "merge"` makes a `--no-ff` merge commit. Conflicts abort and return `{conflict: true, branch, files}`; send those to the worker to resolve on its branch. The caller owns settlement and acceptance; integration does not infer them from idle status.

`keep: true` stops after Git integration. Otherwise cleanup happens **after** integration: the worker's thread session and worktree are removed. Processes still running from inside the worktree (a dev server, a watcher) are sent SIGTERM (`killed`); the thread's teardown doesn't reach them. Then the worker's branch is deleted when all its patches are in HEAD (`git cherry`, since rebasing rewrites commits; `branchDeleted`); if it is unmerged or still checked out, it is kept and the reason is in `branchKept`. `tools.retire({worker})` does the same cleanup without integrating, e.g. for dropped work, whose unmerged branch survives. Both take the receipt's handle or just its name, found under `<checkout>__worktrees/`. Cleanup is sequential, not transactional: if it fails after the merge, the merge remains. Inspect the worktree before repeating cleanup. Nothing is removed on merge failure.

## Reconciler landings

Reconcile/start captures an optional `land` (`local`, `pr-merge`, `pr-review`),
otherwise the owner's committed `.pi/reconcile.json`, otherwise local. CLI:
`bun lib/reconcile/main.ts start <issue> --owner <bb thread id> --land pr-review`. The owner is the bb thread told about exceptions and the final result; when it has closed, the thread holding `supervisor` in `desk/ROLES.md` is.
A resume keeps its saved mode; an explicit conflicting override refuses. Old
states without a mode remain local despite configuration changes.

Local targets the owner checkout. PR modes fetch the captured default base and
own a deterministic staging branch/worktree under the repository's worktree
area. Root and repair workers' ab-parent is staging; collector destinations
remain issue slugs. Integration still runs the existing gates, retained tests,
packet validation and write-ahead recovery. Collector/staging results stay
globally open, with their original reviewed handoffs retained after retirement.

Status includes `land`, `pr` (phase, URL, branch/path, repair receipt) and
`target`; inflight distinguishes staging from owner landing. Ordinary workers
retire while the PR waits. Root PR exceptions resolve on that receipt, not by
redispatching completed children. Stop retires owned workers but retains
staging/published history and receipts, without closing a PR or issues.

Only MERGED plus fetched base ancestry transfers the ledger to
`github:<owner/name>:<base branch>` and closes child-first. Owner sync is
best-effort afterward: fast-forward only when clean and on the base branch.
Dirty, divergent, other-branch or unavailable owners are left untouched; the
saved ownerSync outcome prevents repeating it. PR modes ignore local mainRed.

Publication recovers by repository/head lookup, including interrupted creates.
Remote waits poll about once a minute, with no worker retained. Contributor and
base updates merge without rewriting history; gates precede normal pushes.
CI, gate and conflict repairs share a two-worker repair budget and three
integration attempts. Owner exceptions pause work, not terminal observation.
`pr-merge` requests a head-guarded merge commit only after every reported head
check passes; `pr-review` never requests a merge. The submitted-review selector
remains dormant until its own ticket fills it.

The supplied-host library seam supports seeded scratch observations, not live
GitHub evidence. See [staging first use](attachments/stage-reconciled-root-for-pr-landing/index.md)
and [PR lifecycle first use](attachments/reconcile-pr-checks-and-branch-updates/index.md).

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
