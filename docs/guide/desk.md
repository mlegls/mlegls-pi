# Desk

The main checkout owns the untracked `desk/` directory. From any worktree:

```sh
ab desk path
ab desk role set supervisor
ab desk working set "Supervising the ready tracker frontier"
ab desk attention add "Choose the deployment target" --file /path/to/question.md
ab desk attention remove "Choose the deployment target"
ab desk working clear
ab desk role clear supervisor
```

Pass `--thread thr_…` to override `BB_THREAD_ID`, and `--file -` to read an attention body from stdin. Put your suggested answer on its own `Recommended:` line so the Attention panel offers it as a one-click reply. The helper adds the `##` heading and `Owner:` line; repeating the same owner and title replaces the item. Roles have one holder; working lines and attention items belong to individual threads.

For credentials, pass `--secret NAME=DESCRIPTION` (repeatable) and `--write-env /absolute/path/to/.env`. The helper records `Secret: NAME → PATH: DESCRIPTION` below `Owner:`; the Attention panel collects the masked values, writes them to that file, and notifies the owning thread with `Wrote NAME to PATH`. Use a desk request when the session should keep working (like a supervisor), or `bb secret request` when it can block in its turn.

## Answer in BB

Open **Attention** on BB's rail (`/plugins/tracker/attention`, provided by the tracker plugin). It aggregates desk items across all projects, with a rail badge counting unanswered items; each owner chip jumps to its thread.

- **Take the recommendation** prefills the reply with the `Recommended:` line (still editable).
- Wikilinks and relative links (resolved from `desk/`) open in the Issues panel or BB's file preview.
- Selecting text and clicking **Quote selection** inserts `>` lines. Reply drafts persist until sent; credential inputs are never drafted.
- **Send** dispatches every answered item or filled credential, batched into one message per owner. Answered items collapse and leave the badge count until their owner runs `ab desk attention remove` (editing an item's body re-arms it).

Adding a new item or changing an item's body pushes a system notification with the project, title, and first paragraph; clicking opens the owning thread. Unchanged re-adds, cleans, and handovers stay silent. Delivery errors print one line to stderr without failing the desk write.

Every write prunes archived or deleted BB threads from `ROLES.md` and `ATTENTION.md` (a failed BB lookup leaves both untouched). `ab desk clean` runs pruning alone. `STATUS.md` is owned by the reconciler.

## Supervisor handover

From any checkout of the supervised repository:

```sh
ab desk handover thr_old thr_new
```

Moves role/working lines, attention items, pickup ownership, and unfinished reconciler ownership to `thr_new`, reparents live children, checks `canSpawnChild`, and archives `thr_old` last. Workers and pending exceptions stay untouched; the command is idempotent and returns a JSON summary of moved resources. Running reconcilers must be on handover-aware code before retrying a refusal.

## Module API

```ts
import { setRole, clearRole, setWorking, clearWorking,
  addAttention, removeAttention, cleanDesk, deskPath } from "./lib/desk";
```

Signatures: `setRole(role, threadId, cwd)`, `clearRole(role, threadId, cwd)`, `setWorking(threadId, text, cwd)`, `clearWorking(threadId, cwd)`, `addAttention(threadId, title, body, cwd, { writeEnv, secrets }?)`, `removeAttention(threadId, title, cwd)`, `cleanDesk(cwd)`, `deskPath(cwd)`. `cwd` defaults to `process.cwd()`. Writers serialize on `<git-common-dir>/desk.lock` and atomically replace each file.

## Disposable first-use check

Run from this checkout against a temporary repo + worktree (uses your current `BB_THREAD_ID`, or pass `--thread <id>`):

```sh
helper="$PWD/bin/desk"
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
git init "$fixture/main"
git -C "$fixture/main" -c user.name=Desk -c user.email=desk@example.invalid commit --allow-empty -m fixture
git -C "$fixture/main" worktree add -b worker "$fixture/worker"
cd "$fixture/worker"
"$helper" working set "Trying the shared desk"
printf '%s\n' 'Use staging or production?' 'Recommended: Use staging.' |
  "$helper" attention add "Choose the deployment target" --file -
"$helper" attention remove "Choose the deployment target"
"$helper" working clear
```

See also the [attention inbox packet](../attachments/attention-inbox-in-the-bb-tracker/index.md) and [handover packet](../attachments/supervisor-handover-archives-workers-and-strands-reconciler-ownership/index.md).
