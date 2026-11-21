# Managed process session provenance — implementation handoff

The `process` tool lives in **pi-processes**. Code commit
`f133d8fc77d85c29e935aad243ec4769a4753eda` is on
`managed-process-session-provenance-implement`, based on `ad8a5e3`.
Integrate the code into pi-processes' `local-integration`; landing this
attachment alone does not update the tool. Existing Pi sessions need to reload
the extension or restart after landing.

Bash gets its session ID from the active tool context. Process start previously
inherited only the runtime's environment. It now adds `PI_SESSION_ID` from the
calling context to the child environment, overriding any inherited value.

## First use

Use the worker-owned checkout below. It has a dependency symlink to the
canonical checkout's installation, reproducible with the first two lines.
A standalone Pi session uses the existing model login, starts ephemeral, and
loads the candidate extension explicitly. No tracker writes or services are
needed.

```sh
cd /home/mlegls/dev/pi-processes__worktrees/managed-process-session-provenance-implement
test -e node_modules || ln -s /home/mlegls/dev/pi-processes/node_modules node_modules
pi --offline --no-session -p --mode json -ne -ns -np -nc --no-mcp -a -t bash,process -e ./src/index.ts 'Use exactly these tools in order to check session provenance; do not manually set or pass the value. First call bash with command: printf '\''PI_SESSION_ID=%s\n'\'' "$PI_SESSION_ID". Then call process start with name provenance and the identical command. Then call process wait for provenance. Report each tool'\''s PI_SESSION_ID and whether both values match and are nonempty.' \
  | jq -c 'select(.type == "tool_execution_end") | {toolName, content: .result.content}'
```

Compare the `PI_SESSION_ID` in the `bash` result and the `process` wait result.
They should be equal and nonempty, without putting a literal ID in either command.

## Observed

- Before: the installed tools in the worker's BB thread returned `PI_SESSION_ID=01a1ff2d-061d-743f-b29a-cdefe369cbda` from bash and an empty value from process wait. Both returned the same `BB_THREAD_ID`.
- After: a fresh Pi session loaded the candidate extension and both tool results reported `PI_SESSION_ID=01a1ff2f-8307-7602-b34d-50c498cfc4cb`.
- 130 existing tests passed across `src/tools/actions/start.test.ts`, `src/tools/index.test.ts`, `src/manager.test.ts`, `src/manager.integration.test.ts` and `src/utils/command-executor.test.ts`. Typecheck and formatting for the touched files passed.
