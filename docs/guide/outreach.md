---
for: maintainer
---

# Outreach

[Outreach records](../../skills/enabled/all/mlegls/conventions/outreach/SKILL.md) live in the main checkout's `docs/outreach/`. Run `check` after edits, `snapshot --json` to inspect what BB reads, and `sync` to import messages (review and commit record changes as usual).

## Work the queue in BB

Open `/plugins/tracker/outreach` (or `/plugins/tracker/outreach/<project-id>`):

- **Queue**: active replies and due follow-ups, counted by the rail badge across projects. **Mark handled** (`h`) clears an item without editing the record (**Show handled** undoes it); a new synced reply or changed due date resurfaces the person.
- **Candidates**: uncontacted leads grouped by hypothesis, highest priority first.
- **Hypotheses**: reply/verdict counts and decision bar.
- **Discuss** (`d`): opens a thread with selected people and their linked hypotheses attached (keep **Current** in the composer after a sync if there are uncommitted changes). You can also mention records with `~` in any composer.

To test without real accounts, see the [mock Beeper recipe](../attachments/outreach-conversations-in-the-bb-tracker/index.md).

## Connect sources

1. **Beeper (Mac)**: enable Desktop API in Beeper Desktop → Settings → Integrations and create an access token. Leave Remote Access off; forward the Mac's `127.0.0.1:23373` to the BB server with `ssh -N -L 23373:localhost:23373 <mac-ssh-host>`.
2. **Server credentials**: save `~/.config/outreach/beeper.env` (mode `0600`, via `bb secret request BEEPER_ACCESS_TOKEN --write-env ~/.config/outreach/beeper.env`):

   ```dotenv
   BEEPER_API_URL=http://localhost:23373
   BEEPER_ACCESS_TOKEN=<access token>
   ```

3. **Gmail**: run `composio link gmail` as the BB server user (set `OUTREACH_GMAIL_ACCOUNT` in `beeper.env` if multiple accounts are linked). Gmail matches participant addresses and Reddit DM notifications; Beeper matches by network/handle or `channels.beeper_chat_id` (bridged X chats resolve handles via Matrix profiles, adding ~1 min across a few hundred chats).

Preview and run sync from the outreach project on the server (after `mise run setup` in `mlegls-pi`):

```sh
outreach="$HOME/dev/mlegls-pi/skills/enabled/all/mlegls/conventions/outreach/scripts/outreach.ts"
bun --env-file="$HOME/.config/outreach/beeper.env" "$outreach" sync --dry-run
```

Drop `--dry-run` to write; pass `--beeper` or `--gmail` for one source. Dates use UTC. If Beeper is unreachable, sync records an offline note and still imports Gmail. Last sync times and errors live in `<git-common-dir>/outreach-sync.json`.

## Daily automation

From the outreach checkout on the BB server:

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

If a tunnel is already bound, the new SSH exits cleanly and sync reuses it; if the Mac is asleep, Gmail still syncs. Trigger a first run with `bb automation run <automationId> --project "$project_id"`. Sync only imports messages; it never sends.
