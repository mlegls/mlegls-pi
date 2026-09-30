---
stage: idea
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

Once a supervise job is stopped (`ab supervise stop`), nothing in the CLI retires its workers or clears its children. `resume … drop` is queued into a running loop. Cleaning up `obsidian-implement-sink` on 2026-09-30 took:

- `bun -e "import {retire} from './lib/dispatch.ts'; await retire('<worktree-name>')"` for each worker. `retire` takes a bare worktree name, while `ab mail` addresses the same worker as `wt/mlegls-pi/<name>`, and the `wt/…` form fails.
- Hand-editing `.git/ab-supervise/<job>.json` to drop a child still shown as `waiting: checkpoint`. That wasn't visible until `ab daemon shutdown`, because `ab supervise status` shows the daemon's in-memory record, not the state file.

A `drop`/`retire` that works on a stopped job would cover this, and so would `stop` retiring its workers (keeping unmerged branches, as `retire` already does). Having `retire` accept the mail address form would remove the naming mismatch.
