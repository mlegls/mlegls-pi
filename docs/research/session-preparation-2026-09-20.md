# Session preparation — 2026-09-20 verification

Driven through `advance.run` and `introduce.run` with disposable git projects and persisted parent sessions. Explicit `compact: false` and `memoryExtension: false` isolated this workflow from the already-verified autoread compaction/memory behavior. Raw local artifacts: `/tmp/session-preparation-live.vbKXw6/final/`; reader-session paths are retained in each result's audit.

## Observed

- **Easy — one settled trim-slugs ticket.** Jev chose easy, then candidate 0. DeepSeek submitted a prose directive through `submit_candidates`; the child ended on the successful tool result (`stopReason: toolUse` on the preceding assistant message), with no final-response JSON or follow-up model turn. The directive named `implement`, the exact code change, first action and stopping condition. Total: 268.7 seconds. Context scoring timed out at the existing eight-second deadline; the full briefing was preserved and the warning recorded.
- **Hard — conflicting incident-workflow goals, empty tracker.** Jev chose hard (winning probability .85); the router chose Fable at medium effort. Fable returned a `map`/grilling assignment, concrete questions, stopping condition and context in ordinary prose. The public `text` equaled the reader answer exactly. No candidate-selection or context-filtering call followed it. Optional model advice was separate metadata, absent from the directive. Total: 106.5 seconds.
- Source session bytes and complete project snapshots were unchanged in both runs. Only private reader sessions were created.

These verify the return-channel and workflow mechanisms, not calibrated selection or briefing quality. The hard answer incorrectly asserted that an issue cannot have priority without an owner; the tracker convention contains no such requirement. Strong-model prose is still model judgment, not verified tracker logic. Representative-ticket evaluation belongs with [[projects/mlegls-pi/issues/autoread-show-me]]. Latency is recorded in [[projects/mlegls-pi/issues/session-preparation-latency]].

## Existing checks

- `env -u BB_THREAD_ID bun test`: 186 pass, 2 skip, 10 fail, 1 unhandled error. All ten failures concern terminal IDs/status/alerts and reproduce on the unchanged `88ce495` baseline with its nested dependencies available. No terminal code changed here.
- `bunx tsc --noEmit`: only the five existing errors in Exa tests, session subprocess streams, and system-prompt tests; no errors in the changed/new library files.
- `git diff --check`: clean.
- `scc-delta.sh 88ce495 lib`: code 2058 → 2229 (+171); complexity 398 → 441 (+43).

The abandoned initial implementation demanded JSON in free responses. It was replaced, not made more permissive: reasoning triage returns prose verbatim; only candidate enumeration has a native typed submission tool.
