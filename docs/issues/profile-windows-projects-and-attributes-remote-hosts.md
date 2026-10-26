---
stage: "ticket"
assignee: "agent"
priority: 3
author: "session:thr_zgjve7mckq"
---
idea: in the 2026-10-26 efficiency audit (@thread:thr_zgjve7mckq) both auditors (@thread:thr_ztepcfseav, @thread:thr_ixbgyycyaq) wrote about eight one-off scripts each, because `lib/profile.ts` can't bound or attribute the period. The maintainer agreed to repair it. Four defects:
- `--project … --since` is ignored; project mode prints the `--last` roots with lifetime costs. This was raised in the 2026-10-22 audit and is still open.
- `lib/thread/bb.ts` reads `~/.bb/bb.db`, but an enrolled host's database is `~/.bb-machines/<account>/bb.db` (the Beelink: `~/.bb-machines/mlegls.getbb.app/bb.db`). So Beelink sessions (`~/.bb/pi-bridge-sessions`, 43% of the period's spend) come back without thread IDs.
- Rows are per pi session. A BB thread that moves into and out of a task worktree shows as several roots: one thread had six. The 10-24 burst looked like 45 roots and was 14 threads.
- One long-lived tree appears once per fork or resume. The Mac supervisor thr_vetzcc74ex printed as three roots with ~$811 lifetime each, against $254 inside the period.

ticket: project mode honours `--since`/`--until` and windows costs and active time to them. Each session counts once. `--by-thread` groups sessions by BB thread. The bb database is resolved the way bb does on each host. `--host <ssh-alias>` runs the same query on that host and merges the results. `--evidence <dir>` writes the reusable pack an audit needs: per-thread rows, the user's prompts with thread and msg links, and tool-time totals.

Acceptance: over 2026-10-21T21:30Z→10-25T21:35Z, `--project concept --by-thread --host beelink` lists thr_vetzcc74ex once at about $254, lists thr_7j9zc2etu8 once, and gives Beelink rows thread IDs.
