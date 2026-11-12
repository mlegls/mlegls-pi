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

Use `--thread thr_…` to override `BB_THREAD_ID`. An attention body can come from stdin with `--file -`; it contains the question, options and what waits on it. Put the pick on its own `Recommended:` line so the Attention panel can offer it as a reply. The helper supplies the item's `##` heading and owner. Repeating an owner's title replaces that item. Roles have one holder; working lines and attention items belong to individual threads.

For credentials, pass `--secret NAME=DESCRIPTION` once per variable and `--write-env /absolute/path/to/.env`. The helper records each request directly below `Owner:` as `Secret: NAME → PATH: DESCRIPTION`; it doesn't write the dotenv file. The Attention panel takes the values, writes them to that path and tells the owning thread which variables were written. Use a desk request when the session needs to keep working, as a supervisor does. Use `bb secret request` when the session can wait in its turn for the credential form. Ask for credentials through these forms rather than in thread replies.

## Answer in bb

Open **Attention** on bb's navigation rail (`/plugins/tracker/attention`, provided by the tracker plugin). It lists the desk items across projects, including projects without a vault tracker; the badge counts unanswered items. Each owner chip opens its thread.

Write a reply under each item. **Take the recommendation** fills its reply with the `Recommended:` line; it remains editable. Select a passage in the item, then **Quote selection** to insert it as `>` lines. Reply drafts persist until sent. Credential requests show a masked input for each variable, its description and the full destination path; credential values aren't saved as drafts.

**Send** sends all items with a reply or filled credential, grouped into one message per owner. Credentials go into their requested dotenv file; the owner receives only `Wrote NAME to PATH`. Answered items collapse with the sent text and leave the badge count. They remain in the desk until their owner runs `ab desk attention remove`; rewriting an item's body makes it unanswered again.

The [combined first-use packet](../attachments/attention-inbox-in-the-bb-tracker/index.md) records the helper → panel → grouped owner message → removal journey and supplies a disposable-project replay script.

Adding a new attention item or changing its body sends a system notification with the project and item title, plus the first paragraph. Clicking it opens the owning thread. Re-adding the same title and body, cleaning and handing over send nothing. A failed or undelivered notification prints one line on stderr; the desk write still succeeds. Web and desktop banners need an open bb tab or app window with notification permission; mobile notifications work while the app is closed.

Every write cleans **both** files using bb's live threads, including hidden threads. An archived or deleted owner loses its lines and attention items. Hand over still-needed work before archiving. A failed bb lookup leaves the files unchanged. `ab desk clean` just cleans; `STATUS.md` belongs to the reconciler.

The CLI ships in `bin/desk` and `ab desk`. Before integration, run `./bin/desk --help` or `./bin/ab desk --help` from the worker checkout; neither depends on installing a PATH link.

## Supervisor handover

From any checkout of the supervised repository:

```sh
ab desk handover thr_old thr_new
```

This moves the old owner's role and working lines, attention items, pickup ownership and unfinished reconciler ownership. It reparents live children, checks bb's current `canSpawnChild` capability and archives the old thread last. Workers and pending exceptions stay in place; the JSON result lists the moved resources. Repeating the command is safe after completion or a partial failure.

Reconciler launches and notifications share the handover lock and read the saved owner. The watcher keeps its PID and reads its owner at each scan. Existing landing checkouts remain the targets. Running reconcilers must have loaded handover-aware code; let their automatic code refresh finish before retrying a refusal. Immutable lifecycle dependents, hidden source forks and landing targets in an old managed worktree require separate disposition before that owner can be archived.

A disposable setup with a held needs-input exception, a worker and a live watcher is in [the first-use packet](../attachments/supervisor-handover-archives-workers-and-strands-reconciler-ownership/index.md).

## Module

```ts
import { setRole, clearRole, setWorking, clearWorking,
  addAttention, removeAttention, cleanDesk, deskPath } from "./lib/desk";

await setRole("supervisor", threadId, cwd);
await setWorking(threadId, "Supervising the ready tracker frontier", cwd);
await addAttention(threadId, "Choose the deployment target", questionMarkdown, cwd);
await addAttention(threadId, "Renew service access", questionMarkdown, cwd, {
  writeEnv: "/absolute/path/to/.env",
  secrets: [{ name: "SERVICE_TOKEN", description: "Token for the service" }],
});
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
printf '%s\n' 'Use staging or production?' 'Recommended: Use staging.' 'The deployment waits on this choice.' |
  "$helper" attention add "Choose the deployment target" --file -
printf '%s\n' 'Service access expired; the next sync needs these credentials.' |
  "$helper" attention add "Renew service access" --file - \
    --secret 'SERVICE_TOKEN=Token for the service' \
    --secret 'SERVICE_ACCOUNT=Account identifier' \
    --write-env "$fixture/main/credentials.env"
"$helper" path
# Inspect "$fixture/main/desk/ATTENTION.md" before removing the requests.
"$helper" attention remove "Choose the deployment target"
"$helper" attention remove "Renew service access"
"$helper" working clear
```

To try attention notifications, run this **once** in that disposable worker. It sends two real notifications to the maintainer's enabled devices: one for the new item and one for its changed body. The identical middle add sends nothing.

```sh
printf '%s\n' 'Test attention notification: first body.' | "$helper" attention add "TEST: desk attention notification" --file -
printf '%s\n' 'Test attention notification: first body.' | "$helper" attention add "TEST: desk attention notification" --file -
printf '%s\n' 'Test attention notification: changed body.' | "$helper" attention add "TEST: desk attention notification" --file -
"$helper" attention remove "TEST: desk attention notification"
```

The files are under `$fixture/main/desk`, excluded via the main git directory. To supply an explicit persona, pass `--thread YOUR_LIVE_BB_THREAD_ID`.
