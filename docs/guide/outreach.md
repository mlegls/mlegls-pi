---
for: maintainer
---

# Outreach

[Outreach records](../../skills/enabled/all/mlegls/conventions/outreach/SKILL.md) live in the main checkout's `docs/outreach/`. Run `check` to validate edits and `snapshot --json` to see the queue and sync status BB reads. `sync` imports messages into the Markdown; review and commit record changes as you would other project notes.

## Work the queue in BB

Open `/plugins/tracker/outreach` on your BB server, or go directly to `/plugins/tracker/outreach/<project-id>`. Pick a project with `docs/outreach/`. Queue shows replies and due follow-ups; **Mark handled** (`h`) clears the item from Queue and the Outreach badge without editing the record. The badge counts unhandled items across all projects. Use **Show handled** to undo. Another synced reply or a changed due date can bring the person back.

Candidates groups uncontacted people by hypothesis and shows the highest-priority leads first. Hypotheses shows reply and verdict counts and the decision bar. Select a person or several people and click **Discuss** (`d`); the new thread starts with their records and linked hypotheses. After a sync leaves uncommitted changes, keep **Current** in the composer to submit on that branch. You can also mention a record with `~` in any composer.

To try sync → Queue → Discuss without connecting accounts, use the [disposable BB project and mock Beeper recipe](../attachments/outreach-conversations-in-the-bb-tracker/index.md).

## Connect the sources

1. On the Mac, open Beeper Desktop → Settings → Integrations. Enable the Desktop API, create an access token and leave Beeper running. Remote Access can stay off: the API listens on the Mac's `127.0.0.1:23373`, and the server host reaches it through an SSH tunnel, `ssh -N -L 23373:localhost:23373 <mac-ssh-host>`.
2. On the **BB server host**, save a private `~/.config/outreach/beeper.env` (mode `0600`). `bb secret request BEEPER_ACCESS_TOKEN --write-env ~/.config/outreach/beeper.env` writes the token without showing it to an agent:

   ```dotenv
   BEEPER_API_URL=http://localhost:23373
   BEEPER_ACCESS_TOKEN=<access token>
   ```

3. On that host, `composio link gmail` under the user that runs BB. If several Gmail connections are linked, set `OUTREACH_GMAIL_ACCOUNT` to the intended alias in the dotenv file. Gmail uses participant addresses and Reddit DM notification emails; Beeper matches DMs by network and handle or by `channels.beeper_chat_id`. Bridged X chats carry no username, so sync reads each participant's Matrix profile for the handle; with a few hundred chats that adds about a minute.

Install Bun and the mlegls-pi dependencies (`mise run setup` in the mlegls-pi checkout). With the tunnel open, from the outreach project on the server host, preview imports:

```sh
outreach="$HOME/dev/mlegls-pi/skills/enabled/all/mlegls/conventions/outreach/scripts/outreach.ts"
bun --env-file="$HOME/.config/outreach/beeper.env" "$outreach" sync --dry-run
```

Drop `--dry-run` to import. Pass `--beeper` or `--gmail` to run one source. Log dates and follow-up comparisons use UTC. An unreachable Beeper leaves an offline note and Gmail still runs. Snapshot reports the last successful sync time for each source plus outstanding errors; this status is kept in `outreach-sync.json` in the Git common directory.

## Schedule it daily

On current BB, `--script` selects script mode. Set `project_id` to the BB project and run from the server-host checkout that owns its outreach vault:

```sh
bb automation create --project "$project_id" --name 'Outreach sync' \
  --cron '0 9 * * *' --timezone Etc/UTC --timeout 15m \
  --working-directory "$(git rev-parse --show-toplevel)" --interpreter bash \
  --script 'export PATH="$HOME/.local/bin:$PATH"
ssh -N -o BatchMode=yes -o ExitOnForwardFailure=yes -L 23373:localhost:23373 <mac-ssh-host> & tunnel=$!
trap "kill $tunnel 2>/dev/null" EXIT
sleep 3
mise exec -- bun --env-file="$HOME/.config/outreach/beeper.env" "$HOME/dev/mlegls-pi/skills/enabled/all/mlegls/conventions/outreach/scripts/outreach.ts" sync'
```

The script opens the tunnel for the run and closes it after. If a tunnel is already open, the new one exits on the bound port and sync uses the existing one. With the Mac asleep or off, Beeper reports offline and Gmail still runs.

Adjust the paths or Bun invocation to match the server host's installation. Use `bb automation run <automationId> --project "$project_id"` for the first tick. The automation imports messages; it does not send any.
