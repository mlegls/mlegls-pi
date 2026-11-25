---
stage: "idea"
assignee: "agent"
priority: 2
author: "session:thr_ihbpyrp6s2"
---
On the Beelink, 2026-11-25 07:30–07:40 local, 37 live reconcilers each ran their own tracker `snapshot --json` (bun, ~1–2 s at 40–75% CPU apiece). About ten were in flight at any sample. Load average sat at 75–89 on 16 cores with CPU pressure avg60 ~75%. Four worker launches in a row then failed with `Command thread.start failed / pi did not answer get_state in time`: capture-session-and-applet-provenance-in-tutor-recordings, fresh-official-search-catalogue-takes-an-hour-to-seed, settings-account-deep-link-renders-empty-main, signed-out-session-link-stays-loading-before-account-entry. A fifth followed: keyless-drive-turn-failure-hides-the-scripted-provider-rejection.

The snapshots' share of the load wasn't separated from the test workers, 6 local Convex backends and 7 Vite servers also running. The scans are the part that grows with reconciler count and does the same work in every reconciler.

Two directions: share one snapshot per tracker revision across reconcilers (keyed by tracker HEAD/mtime), and have a launch that fails at thread.start under CPU pressure wait and retry rather than escalate to the owner as "worker errored".
164dd718 shares snapshots across processes in ~/.cache/tracker-snapshots, keyed by issue-file names, sizes and mtimes (inflight:false reads only). A repeat in the concept repo took 0.4–1 s against 6.3 s. Each tracker write still invalidates every key, and launch retry under CPU pressure is still open.
