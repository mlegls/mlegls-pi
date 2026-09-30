# Supervisor hibernation C: first-use packet

## Independent replay

The independent driver at `fea1ca7` reached the Pi RPC surface but both fresh runs canceled the prerequisite H fold before selecting C. The C hibernation and wake are **unobservable in that replay**, not verified by the earlier implementer encounter below. [Predictions, session log, outcomes and replay checks](driver.md); [selected durable metadata](driver-results.json). Setup friction: [[projects/mlegls-pi/issues/empty-journal-drive-cancels-before-c-selector]].
## Setup

The driver `drive.ts` prepares a disposable local project, fake live-child job, ledger and issue, then starts this checkout's `extensions/memory/index.ts` through the installed Pi CLI's public JSON-RPC session surface. It does not start a daemon, container, remote deployment or browser. It writes session data and private RPC transcripts only below a newly created system temp directory; the script prints that path and leaves it for inspection. No credentials are written by the driver.

Persona/auth: local user `mlegls`, existing Pi Anthropic OAuth. Provider `anthropic`, model `claude-haiku-4-5`; readiness was checked with `pi auth check --provider anthropic --json --no-refresh` (`ready`, OAuth). The local session and synthetic campaign artifacts are owned by this checkout's drive process. No shared deployment selector is used.

Run from the repository root:

```sh
bun docs/attachments/supervisor-hibernation-empty-journal/drive.ts
```

This makes real provider calls for the initial journal and wake, and waits 305 seconds for the ordinary Anthropic idle deadline. The experiment lowers only the synthetic session's native compaction gate (`compaction.keepRecentTokens: 64`) and hibernation size gate (`memory.hibernate.minTokens: 1`) so a short campaign reaches the existing hook. It does not shorten or fake the 300-second inactivity deadline.

The driver first creates a normal nonempty memory fold with `memory.journal: true`, then switches the same project's settings to `false`, submits idle turns under a fake live child, waits for automatic hibernation, and wakes the same Pi session with an instruction to read the job, ledger and issue files. It prints the compaction metadata and wake messages; it is a launch/encounter recipe, not an acceptance test. The session JSONL, `result.json`, settings, and fixture artifacts remain under the printed temp root and must not be committed.

## First use

Pi 0.87.1 loaded this checkout's memory extension through JSON-RPC in session `01a0f2bf-775d-73ba-9de0-ffab60f7acf3` using `anthropic/claude-haiku-4-5`. The normal H fold (`fc085d6a`, 14:37:27.195Z) produced a 1,945-character summary and one memory block.

The final idle turn settled at 14:37:32.530Z; the real 300-second Anthropic idle deadline fired at 14:42:32.536Z. The persisted Pi compaction entry `39d1837a` records an empty summary, no blocks, `operation: "empty-journal"`, `generation: "none"`, `trigger: "hibernate"` and `prefixMode: "none"`. Its tail begins at `f24e06cb` (the final idle user turn) and records an estimate of 21 tokens against a 256-token target; this suffix, including later entries through the leaf, is retained verbatim. `attemptTriggers` contains only the earlier ordinary `compact`, confirming hibernation did not generate a journal. The previous H block was absent from the active context after this compaction.

The same Pi session woke and used its `read` tool on the issue, live-child job and ledger. It reported child-alpha still running, cited the job's `"status": "running"`, and followed the issue's instruction to keep waiting and inspect the result before integration. The ledger's prior decision was also read. After C, `./bin/ab memory recall 62fa3f60 --session <session-file> --leaf 39d1837a` returned the original pre-fold user entry, confirming original recall remains available.

Nonvisual encounter; no screenshots.

## Scope

This is one synthetic C-arm first use, not the campaign comparison, a cache benchmark, or evidence of general supervisor efficacy. The exact tail and session evidence are recorded above; see `extensions/memory/README.md` for the selector contract.
