# Desk

The main checkout owns the untracked desk. From any of its worktrees:

```sh
ab desk path
ab desk role set supervisor
ab desk working set "Supervising the ready tracker frontier"
ab desk attention add "Choose the deployment target" --file /path/to/question.md
ab desk attention remove "Choose the deployment target"
ab desk working clear
ab desk role clear supervisor
```

Use `--thread thr_…` to override `BB_THREAD_ID`. An attention body can come from stdin with `--file -`; it contains the question, options/recommendation and what waits on it. The helper supplies the item's `##` heading and owner. Repeating an owner's title replaces that item. Roles have one holder; working lines and attention items belong to individual threads.

Every write cleans **both** files using bb's live threads, including hidden threads. An archived or deleted owner loses its lines and attention items. Re-file still-needed items under a live asker before archiving. A failed bb lookup leaves the files unchanged. `ab desk clean` just cleans; `STATUS.md` belongs to the reconciler.

The CLI ships in `bin/desk` and `ab desk`. Before integration, run `./bin/desk --help` or `./bin/ab desk --help` from the worker checkout; neither depends on installing a PATH link.

## Module

```ts
import { setRole, clearRole, setWorking, clearWorking,
  addAttention, removeAttention, cleanDesk, deskPath } from "./lib/desk";

await setRole("supervisor", threadId, cwd);
await setWorking(threadId, "Supervising the ready tracker frontier", cwd);
await addAttention(threadId, "Choose the deployment target", questionMarkdown, cwd);
await removeAttention(threadId, "Choose the deployment target", cwd);
await clearWorking(threadId, cwd);
await clearRole("supervisor", threadId, cwd);
```

All mutations return the desk path. `cwd` defaults to the process directory. Writers serialize on the shared git directory's `desk.lock` and atomically replace each file; a lock timeout names the lock path.

## Safe first-use setup

Requires git, Bun and the running bb daemon; use your existing bb thread identity, with no new threads or credentials. This prepares a disposable repository rather than modifying the project's real desk. From this package's checkout:

```sh
helper="$PWD/bin/desk"
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
git init "$fixture/main"
git -C "$fixture/main" -c user.name=Desk -c user.email=desk@example.invalid commit --allow-empty -m fixture
git -C "$fixture/main" worktree add -b worker "$fixture/worker"
cd "$fixture/worker"
"$helper" working set "Trying the shared desk"
"$helper" path
"$helper" working clear
```

The files are under `$fixture/main/desk`, excluded via the main git directory. To supply an explicit persona, pass `--thread YOUR_LIVE_BB_THREAD_ID`.
