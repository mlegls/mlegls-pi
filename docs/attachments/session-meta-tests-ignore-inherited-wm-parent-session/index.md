# Session metadata test isolation — first-use drive

## Predictions (written before running the test)

- In a worker process with `PI_WM_PARENT_SESSION` present, running `bun-axi test lib/session-meta/index.test.ts` should pass the “records one entry at session start” case without manually unsetting the variable. Its expected metadata should not accidentally include the inherited parent.
- Session metadata should still record a parent session when explicitly supplied through the public metadata path; the fixture fix should not remove production support. I expect the focused suite to cover this, but a green result alone may not demonstrate which assertion passed without seeing test names.

## Setup to attempt

Local CLI test in this worktree; no deployment URL, server, account, or seeding supplied. The test command is the handoff's runnable entry point. Use the inherited worker environment, with no `env -u PI_WM_PARENT_SESSION` override. The intended target is this checkout, not a shared service.

## Encounter

Not started.
