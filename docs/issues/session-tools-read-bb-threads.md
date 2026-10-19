---
stage: "done"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
---
`lib/profile.ts`, `lib/graph.ts`, `lib/prompts.ts` and `lib/context.ts` don't see bb threads, which is now how every session runs.

Found during the 2026-10-19 retro of the concept supervisor and a triage thread:
- `graph.ts` scans `~/.pi/agent/sessions` and registry threads only; a plain bb thread's session lives in `~/.bb/pi-bridge-sessions/<providerThreadId>.jsonl` (`bbSessionFile` in `lib/thread/bb.ts` already resolves it), so `profile 01a13a17…` failed with "no session matches".
- `profile` should accept a `thr_…` id; `prompts.ts` misses the maintainer's prompts in bb threads (bb's `prompt_history_entries` in `~/.bb/bb.db`, or `bb thread history --json`, has them per thread).
- `profile --project concept --last N` lists empty sessions with negative spans (`span -1792342103s`).
- `context.ts` didn't finish in 180s on the 88MB supervisor session.

## Result

done

`profile`, `context`, `prompts` and the session graph now see bb threads (`47dd971e`).

- **bb sessions in the graph:** `lib/graph.ts` scans `~/.bb/pi-bridge-sessions`, taking each session's id from its header. It reads `~/.bb/bb.db` read-only (new `bbSessions` in `lib/thread/bb.ts`) for each session's bb thread, the thread's parent (a spawn edge to the parent thread's latest session) and its title. Rewound sessions resolve their fork parent by reading the file's id instead of guessing it from the file name.
- **`thr_…` ids:** `profile` and `context` take a bb thread id and use its latest session (shared `findNode` in `lib/graph.ts`). An ambiguous fragment now lists the sessions it matches.
- **Prompts:** `lib/prompts.ts` adds a `bb` source from bb's `prompt_history_entries` (`bbPrompts`).
- **`--project --last`:** sessions with no turns are dropped, a session with no messages spans zero instead of going negative, and a rewound root (fork parent) counts as a root.
- **`context` on the 88MB supervisor session:** parsing takes about 1s. The slow part was about 5,700 classifier calls, all lost if the run was cut short. `judgePurposes` now judges at most 600 cells per run, the most-held first, and caches as it goes. The command prints how many cells stay classed by kind, and a rerun continues.
- **Checks after rebasing onto `dcbc4e7f`:** `lib/thread` tests pass (17). `tsc` is clean apart from existing errors in `extensions/obsidian-tracker`. I ran `profile thr_vetzcc74ex`, `profile --project concept --last 3`, `context thr_vetzcc74ex --fast` and a `prompts` search against real data. I wrote no new tests and didn't run the timeline view.
- **Open:** whether 600 is the right per-run default.
