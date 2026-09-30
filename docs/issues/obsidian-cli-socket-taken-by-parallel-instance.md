---
stage: idea
author: session:tracker-obsidian-views-review-1
---

Observation, during [[projects/mlegls-pi/issues/archive/tracker-obsidian-views]] review: the desktop `obsidian` CLI (`/Applications/Obsidian.app/Contents/MacOS/obsidian-cli`) connects to `$HOME/.obsidian-cli.sock`. A parallel worker started a second Obsidian instance with only `--user-data-dir=<worktree>/.wm/obsidian-profile`; that instance rebound `~/.obsidian-cli.sock`, so every CLI call from other workers (including `obsidian version`) went to its profile and failed with "Command line interface is not enabled", although the main instance's `obsidian.json` still had `"cli": true`. The main instance kept running but became unreachable by CLI.

Workaround used: run an owned instance with its own home and profile, and give the CLI the same home:

```sh
HOME=/tmp/<worker>-home /Applications/Obsidian.app/Contents/MacOS/Obsidian --user-data-dir=/tmp/<worker>-home/profile   # via ab service start
HOME=/tmp/<worker>-home obsidian vault=<name> eval code=...
```

The profile needs `obsidian.json` with the vault registered and `"cli": true`; the trust prompt reappears per profile.

Proposed: drive docs (`docs/computer.md` or an Obsidian setup helper) should say that a separate Obsidian instance must also get a separate `HOME`, or reuse this pattern in a shared helper, so parallel drivers don't take over the user's CLI socket.
