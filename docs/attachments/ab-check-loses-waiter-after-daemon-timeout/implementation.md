# Implementation first use

Starting revision: `dd0836cf8a49ce83d92a5c7af71bd25e4963ce21`.
This is an implementer trial, not independent acceptance.

## Setup

Local Bun CLI, this checkout's `ab/main.ts`, no authentication or seed data.
Use a fresh `AB_STATE` so no shared daemon or execution is touched. From the
checkout, this entry point starts the local surface and cleans up its daemon:

```sh
state=$(mktemp -d)
export AB_STATE="$state" AB_CHECK_SLOT=""
trap 'bun ab/main.ts daemon shutdown; rm -rf "$state"' EXIT
bun ab/main.ts check -- /bin/echo ready
```

For timeout driving, keep the isolated state until finished. Its daemon PID is
in `$AB_STATE/daemon.pid`. SIGSTOP/SIGCONT of that PID can introduce a delay
longer than the 5-second request timeout; keep it below the 30-second caller
lease. Resume it before shutdown. No production delay cause was established.

## Observed

A temporary CLI experiment started two 10-second commands and a queued command
(`echo once; exit 7`), then paused the isolated daemon for 7 seconds. All three
callers printed `daemon request timed out; retrying receipt`. After resumption:

- Running receipts `a7802ba3-397c-4a33-8a3a-03a6cc475590` and
  `64fbb1e8-014f-4078-acb4-7894405b6b87` returned 0 with their expected output.
- Queued receipt `f7f62c84-b0ac-45aa-9ae1-2fd500f38e6b` returned 7 and printed
  `once` once. Listing still contained exactly the three original executions;
  none had a cancellation reason.
- A fourth running check was paused for 6 seconds, then its caller received
  SIGINT and the daemon resumed. The caller returned 130; its receipt reported
  `no waiting callers`.

The isolated daemon was shut down and its temporary state removed.
Existing focused regressions: `ab check -- bun test ab/resources.test.ts lib/resources`
passed (8 tests, 36 assertions). No new permanent acceptance tests were added.
The explicit-directory suite `ab check -- bun test ./ab ./lib/resources` passed
(19 tests, 105 assertions). A bare `ab` filter also selected optional disabled
skills and hit an unrelated missing dependency; see
[the discovery/setup issue](../../issues/disabled-watch-pr-tests-missing-commander.md).
`git diff --check` passed. No root lint scripts are configured in `package.json`.
