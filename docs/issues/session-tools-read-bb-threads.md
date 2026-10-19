---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
---
`lib/profile.ts`, `lib/graph.ts`, `lib/prompts.ts` and `lib/context.ts` don't see bb threads, which is now how every session runs.

Found during the 2026-10-19 retro of the concept supervisor and a triage thread:
- `graph.ts` scans `~/.pi/agent/sessions` and registry threads only; a plain bb thread's session lives in `~/.bb/pi-bridge-sessions/<providerThreadId>.jsonl` (`bbSessionFile` in `lib/thread/bb.ts` already resolves it), so `profile 01a13a17…` failed with "no session matches".
- `profile` should accept a `thr_…` id; `prompts.ts` misses the maintainer's prompts in bb threads (bb's `prompt_history_entries` in `~/.bb/bb.db`, or `bb thread history --json`, has them per thread).
- `profile --project concept --last N` lists empty sessions with negative spans (`span -1792342103s`).
- `context.ts` didn't finish in 180s on the 88MB supervisor session.
