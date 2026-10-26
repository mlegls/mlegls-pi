# Project profiling: implementation first use

Independent acceptance: [fresh CLI drive at dd7fdb06](drive-2.md), including predictions, observed historical query, replayable checks and cleanup.

Implementation trial at code revision 91970414 plus the following evidence commit, whose final changes were re-driven on the live Mac→Beelink query: the session-count label is spelled out and the last in-window reply is preserved for wait classification. This is CLI/API evidence, not a fresh verifier's acceptance report. No screenshots or permanent tests were added.

## Required and prepared environment

The historical Concept session logs on both the owner's Mac and Beelink, their BB identities, and the Mac's existing non-interactive SSH alias `beelink` are required. This worker checkout is on Beelink, not the Mac.

Prepared a read-only, self-contained collector from this branch on Mac host `host_w74xscm3fz` (`s-MacBook-Pro.local`), in an exclusively owned temporary directory. Used the owner's existing enrolled BB login and Mac→Beelink SSH; no new authentication, database writes, seed, checkout changes or SSH trust changes. Mac→Beelink SSH and Bun were observed ready. The command completed successfully and opened the actual query surface. Both host databases used were recorded:

- Mac: `/Users/mlegls/.bb/bb.db`. `bb status` on the Mac reports the moved server's Linux data directory, so a nonexistent local server path must not suppress this database.
- Beelink: `/home/mlegls/.bb-machines/mlegls.getbb.app/bb.db`.

All implementation-owned remote terminals and temporary directories were removed after the trial. The first-use target is reproducible, not a resident service.

## Runnable entry

From a Mac checkout containing this branch:

~~~sh
bun lib/profile.ts --project concept --since 2026-10-21T21:30Z --until 2026-10-25T21:35Z --by-thread --host beelink --evidence /tmp/concept-audit
~~~

From this Beelink checkout, prepare the same read-only surface on the enrolled Mac:

~~~sh
bun docs/attachments/profile-windows-projects-and-attributes-remote-hosts/prepare-mac.ts
~~~

The setup prints the owned target, a directly runnable `bb terminal create … --command 'bun …/run.ts' --json` entry, the evidence index path and the exact cleanup command. Run the entry, use `bb terminal wait <id> --exit --from-start`, then `bb terminal output <id>`. Close that terminal and run the printed cleanup command when finished. The setup bundles this checkout, so the Mac's canonical checkout need not be changed. The prepared entry invokes the same `projectReport` used by the CLI with the exact query above.

Local Beelink-only first use also succeeded with the CLI above minus `--host beelink`. SSH from Beelink to its own hostname initially failed host-key verification; that is not the prepared Mac→Beelink deployment and no shared trust settings were modified.

## Observations

Window: **2026-10-21 21:30 UTC through 2026-10-25 21:35 UTC**, inclusive.

| Claim | Observed result |
|---|---|
| Project mode windows costs and active time | All 759 profiles are within the requested window: earliest start 2026-10-21T21:30:00.000Z, latest end 2026-10-25T21:35:00.000Z, zero outside. Costs use completion timestamps. A temporary boundary experiment observed 3,000 ms model + 2,000 ms tool inside a 3,000→8,000 ms window, including prorated nested tool time, with only the completed in-window charge. |
| Long-lived supervisor occurs once at about $254 | `thr_vetzcc74ex` occurs once: **$254.1766146**, 339 sessions including descendants, 53.74 aggregate active hours. Its three own sessions cost $98.1227158; project mode retains root-tree totals, rather than presenting that exclusive cost as the baseline. |
| Worktree moves do not multiply a thread's roots | `thr_7j9zc2etu8` occurs once: **$5.4140596**, six sessions, 0.74 aggregate active hours. |
| Beelink identities resolve | **329/329** Beelink sessions have BB thread IDs. |
| Each session counts once | **759 sessions, 759 distinct IDs, 759 root assignments, 759 distinct assigned IDs**. The 48 grouped root rows total $695.9298767, equal to the sum of exclusive session costs (floating-point rounding only). |
| Remote query merges the same implementation | Mac bundled collector queried Beelink over SSH. The remote required no checkout update; its temporary bundle was removed on exit. Mac and Beelink contributed 430 and 329 sessions respectively. |
| Evidence is reusable | Pack contains query/host provenance, 48 grouped root rows, 697 exclusive thread rows, all session/source-file rows, **245 user prompts with 245 BB thread/message references**, and tool/inner/wait totals. Top-level tool time totals **270,776,382 ms**; 591 nested-tool keys. Raw user prompts were not committed. |

Selected final rendered lines (the session-count suffix is now spelled out):

~~~text
2026-10-24T05:20 thr_7j9zc2etu8 $5.41 active 0.74h 6 sessions s-MacBook-Pro.local Format markdown and latex in flashcards
2026-10-21T21:30 thr_vetzcc74ex $254.18 active 53.74h 339 sessions s-MacBook-Pro.local concept
~~~

`roots.json` is the grouped root-tree baseline displayed by `--by-thread`; `threads.json` is the exclusive per-thread ledger for further attribution. Summing root rows or exclusive thread rows is meaningful; summing both together is not. Non-BB sessions retain their session IDs and file anchors rather than fabricated BB references.

## Checks and limits

- `bun test lib/thread/bb-pi.test.ts lib/thread/runtime.test.ts lib/session-meta/index.test.ts`: **16 passed, 0 failed**, 46 assertions.
- `bun run typecheck`: passed.
- Temporary boundary diagnostic: passed after repairing the clipped profile's start timestamp.
- `git diff --check`: passed.
- No full suite run; the integration gate owns it. No permanent tests added.
- Nested calls supply durations rather than individual start timestamps; a call crossing a window boundary is prorated by its enclosing tool interval. This approximation is explicit in the generated pack.
- Cross-host copies of the same pi session ID use the most complete window, not two separately billed copies.
