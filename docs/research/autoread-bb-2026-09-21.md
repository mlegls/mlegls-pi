# BB autoread verification — 2026-09-21

Request: make advance/introduce readers visible and inspectable as BB child threads rather than private subprocesses.

## Observed

- Live ordinary reader: @thread:thr_e8jbxuzn3z forked the calling Pi thread, appeared as its visible child, read package.json, and returned the correct package name. BB retained both the read and final answer. The result included its BB thread ID and session file.
- Live structured follow-up: @thread:thr_ug5nng7tq3 forked the broad reader (not the parent), remained a child of the calling thread, and returned native submit_candidates details without parsing prose. Archived after verification.
- Live default compaction path: @thread:thr_yfayrs796h compacted its fork before continuing and returned the package name. Completion stopped its runtime while retaining visible history.
- Final integrated follow-up: @thread:thr_aqesjdc9gc used the concurrently added reader-profile exec API to read/grep package.json, then returned native submit_candidates details. Relative submission-extension paths resolved correctly. It is idle, visible, and has no queued messages.
- A one-millisecond timeout rejected with the child reference; an AbortController cancellation after six seconds rejected with the supplied reason. Cancellation probe @thread:thr_a7cpz5jfs4 was idle with zero queued messages afterward. Archived failed/cancelled development probes; kept successful visible examples.
- A provider-rejected model surfaced as a reader failure, not a successful empty briefing. The failing child retained the provider error.

## Lifecycle details discovered

BB returns idle forks before provisioning has fully settled. Initial messages sent with thread tell could remain queued on provisioning in this installed BB version. The adapter creates one queued message and explicitly sends it after provisioning; if BB auto-consumed that message, the resulting not-found response is not retried with a duplicate prompt. Polling tolerates initial idle state until execution starts. Cleanup deletes only that request's queued message and always attempts to stop the child, preserving user-added queue entries and the transcript.

BB owns the runtime, normal extension loading, compaction, and fork history. The package host hook supplies the reader stance/tool restriction and typed result file. Source threads must use Pi on the calling thread's host. Only completed source turns are inherited. No files were changed by the reader probes.

## Checks and limits

- bunx tsc --noEmit and git diff --check: pass.
- Full suite under BB: 186 pass, 2 skip, 17 fail, 1 inter-test error. Seven failures are the known board-under-BB mismatch; ten are terminal/tmux ID or timing failures.
- Full suite with BB_THREAD_ID removed: 193 pass, 2 skip, 10 fail, 1 inter-test error. Remaining failures are terminal/session tests, including expected short IDs versus decorated tmux IDs. The same failing test names reproduced in a clean HEAD archive; the archive also had unrelated module-resolution failures and is not claimed as a clean full baseline.
- Concurrent reader-profile work modified shared autoread files during this task and landed separately as c7ff361. Preserved those edits; the final live structured reader exercised the combined state. The BB host uses that reader profile; lifecycle and typed-result handling remain separate from the tool-interface choice.
- SCC script against starting ref 0158e174a366e964d4ca702998767b806f1b6493, scoped to lib with node_modules excluded: code 5901 → 6085 (+184), complexity 1344 → 1429 (+85). This working-tree scope includes the small concurrent reader-profile changes in autoread. Growth pays for BB lifecycle/queue handling and the typed host result channel; recorded in docs/frictions.md. Used the installed scc 4.1.0 through mise exec because the global shim had no selected version.
- No automated tests were authored in this implementation pass. Verification used the real BB CLI, Pi child sessions, existing suite, and typecheck.

Existing exec kernels need /exec-reset to load the changed backend. New BB children load the package host entrypoint automatically. No BB app restart is needed.
