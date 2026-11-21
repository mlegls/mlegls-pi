---
for: maintainer
---

# Outreach

[Outreach records](../../skills/enabled/all/mlegls/conventions/outreach/SKILL.md) live in the main checkout's `docs/outreach/`. Run `check` to validate edits and `snapshot --json` to see the queue and sync status BB reads. `sync` imports messages into the Markdown; review and commit record changes as you would other project notes.

## Connect the sources

1. On the Mac, open Beeper Desktop → Settings → Integrations. Enable the Desktop API, create an access token, then turn on **Remote Access** under Advanced. [Remote Access](https://developers.beeper.com/desktop-api/advanced/remote-access) listens on all interfaces; restrict port `23373` to the tailnet and leave Beeper running.
2. On the **BB server host**, save a private `~/.config/outreach/beeper.env` (mode `0600`):

   ```dotenv
   BEEPER_API_URL=http://<mac-tailscale-host>:23373
   BEEPER_ACCESS_TOKEN=<access token>
   ```

3. On that host, `composio link gmail` under the user that runs BB. If several Gmail connections are linked, set `OUTREACH_GMAIL_ACCOUNT` to the intended alias in the dotenv file. Gmail uses participant addresses and Reddit DM notification emails; Beeper matches DMs by network and handle or by `channels.beeper_chat_id`.

Install Bun and the mlegls-pi dependencies (`mise run setup` in the mlegls-pi checkout). From the outreach project on the server host, preview imports:

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
exec mise exec -- bun --env-file="$HOME/.config/outreach/beeper.env" "$HOME/dev/mlegls-pi/skills/enabled/all/mlegls/conventions/outreach/scripts/outreach.ts" sync'
```

Adjust the paths or Bun invocation to match the server host's installation. Use `bb automation run <automationId> --project "$project_id"` for the first tick. The automation imports messages; it does not send any.
