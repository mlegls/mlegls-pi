---
stage: "done"
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

## Result

done — The change holds all five stories. I made one small repair and did not re-drive the Mac→Beelink query after it.

- **Review:** I read the diff for the profile change (`lib/profile.ts`, `lib/profile-project.ts`, `lib/thread/bb.ts`) together with the driver's log. I found no defects against the ticket and no unresolved frictions. The driver filed none, so there was nothing to triage in the tracker.
- **Repair:** I removed `recent()` from `lib/profile.ts` (commit 4a42466d). Nothing called it any more now that `--project` goes through `projectReport`. The Mac→Beelink query doesn't exercise `recent()`, so I judged the driver's results unaffected.
- **Checks after the repair:**
  - `bun run typecheck` passes.
  - The 16 bb, runtime and session-meta tests pass.
  - A local windowed `--project concept --by-thread --evidence` run wrote the pack. This host has no Concept data, so it checks the code path, not the acceptance numbers.
- **Packet:** I appended a review section to the driver's `drive-2.md` (commit 3f82c7a6).
- **Left running:** nothing.

```yaml
commit: 3f82c7a6
stories:
  - story: Project query windows cost and active time to the requested historical period
    outcome: held
  - story: Thread grouping consolidates resumed and moved sessions
    outcome: held
  - story: Remote host merge resolves Beelink BB identities
    outcome: held
  - story: Each session counts once
    outcome: held
  - story: Evidence includes attribution, linked user prompts, and tool-time totals
    outcome: held
evidence:
  path: docs/attachments/profile-windows-projects-and-attributes-remote-hosts/drive-2.md
  visual: false
  shots: []
tests:
  - lib/thread/bb-pi.test.ts
  - lib/thread/runtime.test.ts
  - lib/session-meta/index.test.ts
fixed:
  - "removed the dead recent() export in lib/profile.ts (4a42466d)"
caveats:
  - "The Mac→Beelink acceptance query was not re-driven after the dead-code removal."
  - "Window-boundary proration of nested tool durations is an approximation, documented in the generated pack. The driver did not measure its accuracy independently."
  - "Remote --host builds a bundle of lib/profile-project.ts per query with Bun.build and sends it over SSH; each run pays that build. I did not measure it."
```

Evidence: [docs/attachments/profile-windows-projects-and-attributes-remote-hosts/drive-2.md](../attachments/profile-windows-projects-and-attributes-remote-hosts/drive-2.md)
