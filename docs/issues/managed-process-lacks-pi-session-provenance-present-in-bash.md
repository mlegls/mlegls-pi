---
stage: "done"
assignee: "agent:auto-routine"
author: "session:01a1c5bb-a391-74f0-bf18-04f956c1a35c"
priority: 3
---
While refining [[projects/concept/issues/reach-complete-5000-card-import-and-next-turn-after-residual-repairs]] on 2026-11-10, the managed `process` tool expanded `$PI_SESSION_ID` to empty in a tracker create command; tracker refused it with `author must be a nonempty provenance string`. The same thread's `bash` tool returned `PI_SESSION_ID=01a1c5bb-a391-74f0-bf18-04f956c1a35c`. A direct managed command, `printf 'PI_SESSION_ID=%s\nBB_THREAD_ID=%s\n' "$PI_SESSION_ID" "$BB_THREAD_ID"`, confirmed an empty PI_SESSION_ID while BB_THREAD_ID remained `thr_tz9durraem`.

Workaround: read the provenance from bash and supply its literal value to the managed tracker command; retry succeeded. The tracker recipe uses `$PI_SESSION_ID`, and tracker writes run through managed processes to accommodate hooks. Cause is unestablished. Related environment mismatch: [[projects/mlegls-pi/issues/managed-process-nested-shell-loses-mise-python-path]].

Reproduced on 2026-11-17 while refining [[projects/concept/issues/generate-and-grade-problems-by-program]]: bash returned `PI_SESSION_ID=01a1e76e-1b2a-7631-b217-d996b1ec5462`; a managed tracker create using `$PI_SESSION_ID` failed with the same author diagnostic, and managed `printf` showed it empty. Supplying the literal bash value made the create succeed.

## Result

done — The driver observed identical nonempty IDs from `bash` and managed `process` in the same fresh Pi session. Review reran the five affected pi-processes test files: 130 passed.

```yaml
commit: 406a8839
stories:
  - story: A managed command can expand the same nonempty PI_SESSION_ID as bash.
    outcome: held
evidence:
  path: docs/attachments/managed-process-lacks-pi-session-provenance-present-in-bash/index.md
  visual: false
  shots: []
fixed:
  - Updated the replay recipe to use the verified prompt delimiters so sentence punctuation stays out of the shell command.
tests: []
filed: []
caveats:
  - Before closing, integrate f133d8fc77d85c29e935aad243ec4769a4753eda into pi-processes local-integration. This branch contains only evidence. Existing Pi sessions need a reload or restart to pick up the fix.
```

Evidence: [docs/attachments/managed-process-lacks-pi-session-provenance-present-in-bash/index.md](../attachments/managed-process-lacks-pi-session-provenance-present-in-bash/index.md)
