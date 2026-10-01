---
stage: ticket
assignee: agent
priority: 3
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
part-of: "[[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]]"
blocked-by: ["[[projects/mlegls-pi/issues/supervisor-constraints-reach-workers-a-turn-late]]"]
---

Carried to the reconciler 2026-10-01, where it is worse: `lib/reconcile/main.ts` has no stop at all (start, run, status, resolve). Stopping one means killing its process, which leaves its workers, handlers and `tree/<slug>` collectors. The contract becomes a reconcile stop that retires workers and handlers, keeps unmerged branches, and marks the state finished.

Once a supervise job is stopped (`ab supervise stop`), nothing in the CLI retires its workers or clears its children. `resume … drop` is queued into a running loop. Cleaning up `obsidian-implement-sink` on 2026-09-30 took:

- `bun -e "import {retire} from './lib/dispatch.ts'; await retire('<worktree-name>')"` for each worker. `retire` takes a bare worktree name, while `ab mail` addresses the same worker as `wt/mlegls-pi/<name>`, and the `wt/…` form fails.
- Hand-editing `.git/ab-supervise/<job>.json` to drop a child still shown as `waiting: checkpoint`. That wasn't visible until `ab daemon shutdown`, because `ab supervise status` shows the daemon's in-memory record, not the state file.

A `drop`/`retire` that works on a stopped job would cover this, and so would `stop` retiring its workers (keeping unmerged branches, as `retire` already does). Having `retire` accept the mail address form would remove the naming mismatch.

ticket contract, 2026-09-30: a stopped job's workers can be retired and its children cleared from the CLI (either `resume … drop` working on a stopped job, or `stop` retiring its workers while keeping unmerged branches as `retire` already does), and status reflects that without a daemon restart. `retire` accepts the `wt/<repo>/<name>` mail address form as well as the bare name.
