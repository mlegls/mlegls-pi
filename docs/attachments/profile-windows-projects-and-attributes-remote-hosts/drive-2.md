# Independent CLI drive

Tested revision: dd7fdb06fcc68f43bfef6dd49e5b8e5fe7f18e01. Nonvisual CLI/public report surface; no source, tests or fixtures inspected.

## Predictions recorded before opening the product

- Windowed Concept query will report only costs and active time in 2026-10-21T21:30Z through 2026-10-25T21:35Z, not lifetime totals. **Met:** generated report declares clipped intervals and completion-window charges; all 759 session envelopes are within the interval and the historical supervisor costs $254.18 rather than ~$811.
- Grouping will show thr_vetzcc74ex once at approximately $254 and thr_7j9zc2etu8 once; session assignments will not duplicate. **Met.**
- Mac-to-Beelink query will combine both hosts and retain Beelink BB thread IDs. **Met.**
- Evidence directory will contain reusable per-thread attribution, user prompts with thread/message links, and tool-time totals. **Met.**

## Setup and encounter

Ran `bun docs/attachments/profile-windows-projects-and-attributes-remote-hosts/prepare-mac.ts` from this worktree. It completed successfully before entry. Target: exclusively owned Mac directory `host_w74xscm3fz:/private/tmp/mlegls-profile-4700558a-901b-42c3-8e38-ac5a54d69da5`; persona: owner's enrolled BB and existing Mac→Beelink SSH; seed: existing read-only historical logs and databases, no changes. This is a bundled worktree collector, not a canonical Mac checkout modification.

Ran the printed entry using `bb terminal create --host host_w74xscm3fz --command 'bun <owned-dir>/run.ts' --json`. Waited for terminal exit (0), then read terminal output and generated evidence files via `bb file read`. This is the documented public projectReport collector entry, using the exact ticket query; not a unit test. Setup and query each took seconds and required no interactive authentication.

Generated query provenance records Mac data directory `/Users/mlegls/.bb` and Beelink `/home/mlegls/.bb-machines/mlegls.getbb.app`. Window matches the ticket exactly.

## Observations and replayable checks

Recreate with the committed setup and printed entry; inspect `<owned-dir>/evidence/` before cleanup.

| Story / check | Observable acceptance | Observed |
|---|---|---|
| Window cost and active-time report | Supervisor near $254, timestamps inside requested range, active time shown | One thr_vetzcc74ex row: $254.1766146, 193472427 active ms (53.74 aggregate hours), 339 sessions. All 759 session profile start/end envelopes inside window. Held for historical query; no independent synthetic boundary experiment performed. |
| Group resumed/moved sessions | One row for each named thread; no repeated assigned IDs | thr_7j9zc2etu8 once: $5.4140596, six sessions. thr_vetzcc74ex once. 48 roots have 759 assignments and 759 distinct IDs. Held. |
| Merge remote host and resolve enrolled database | Both host provenances; Beelink sessions carry IDs | 430 Mac sessions and 329 Beelink sessions; 329/329 Beelink sessions identified. Held. |
| Count each session once | Session ledger IDs unique and exclusive cost equals grouped total | 759 ledger rows, 759 distinct IDs; exclusive sum $695.9298767000005, grouped sum $695.9298766999998 (rounding only). Held. |
| Reusable evidence | Thread rows, linked user prompts, tool totals and provenance | index.md links roots.json, threads.json, sessions.json, prompts.md/json, tools.json and query.json. 245 prompts, all 245 have thread/message links (example syntax `@thread:thr_nt35tbjva9#msg=1015`). Top-level tool total 270776382 ms; inner/wait breakdowns present. Held. |

The generated index explains that roots include descendants, threads are exclusive, and nested durations crossing a boundary are prorated. That clarification met the expectation formed while using the pack that its two ledgers should not be summed together. Active time is aggregate across workers, not elapsed wall-clock time.

## Frictions and limits

No unresolved product friction encountered in the assigned journey. Historical observed results, not implementation assertions, establish the acceptance examples. Exact boundary proration accuracy was not independently measured; the pack explicitly states its approximation. Prompt contents and raw historical session artifacts were deliberately not committed.

## Cleanup

Closed all three owned Mac terminals (query and two generated-artifact summary reads). Removed the owned Mac temporary directory with the setup's printed cleanup command; removal succeeded. No servers, remote directories or terminals left running. Original user data untouched.
