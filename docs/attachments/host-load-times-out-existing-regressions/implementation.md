# Queued full-suite implementation trial

Tested revision: `11e8b91d9c503b821cfa979039ba6d5a1943c3f5` (2026-10-15).
These are implementer observations; independent acceptance follows separately.

## Setup and first use

- Required and prepared environment: local macOS CLI checkout, no server or browser.
- Owned checkout: `/Users/mlegls/dev/mlegls-pi__worktrees/host-load-times-out-existing-regressions-implement-1`, branch `host-load-times-out-existing-regressions-implement-1`.
- Persona/authentication: local shell user; no credentials or external account needed.
- State: no seed needed; existing tests create their own fixtures. Supervisor-provided `mise run setup` completed before the trial. Repeat that command in a fresh checkout.
- Readiness observed: `heavy`, `sem`, `mise` and `bun` resolve on PATH. Bun 1.4.3, mise 2026.8.6. `~/.local/bin/heavy` delegates to the canonical repository's existing `bin/heavy`.
- Runnable entry point from the prepared checkout: `mise run test`.

## Observations

| Claim / action | Observed result |
| --- | --- |
| Suite-wide timeout | `[test] timeout = 20000` in `bunfig.toml`; no individual test timeout edits. |
| Scoped arguments: `mise run test lib/thread` | 13 pass, 0 fail, 4 files, 19.53 s. The archive-conflict resume case took 6.140 s without a default-timeout failure. |
| Missing queue executable: `env PATH=/usr/bin:/bin /Users/mlegls/.nix-profile/bin/mise run test lib/thread` | Exit 1, `heavy must be on PATH to queue tests`; Bun did not start. |
| Two concurrent `HEAVY_SLOTS=1 mise run test` requests | Both exited 0. Each ran 225 tests across 51 files: 223 pass, 2 skip, 0 fail, 12,438 assertions. First: 128.48 s in Bun; second: 109.80 s in Bun. |
| Agent guidance | Package skill names `mise run test` for full suites and permits `bun test <file>` for one file. No `AGENTS.md` exists in this checkout. |
| Typechecking: `bunx tsc --noEmit` | Exit 0. |

Both full runs retained the existing skipped cases: `concurrent thread workers preserve any/all reports and close removes owned worktrees` and `CLI snapshot parity against selected project vault`.

Timestamped output observations (UTC):

| Event | First request | Second request |
| --- | --- | --- |
| Request launched | 05:13:22.059 | 05:13:23.057 |
| Bun startup line | 05:13:22.850 | 05:15:31.659 |
| Bun summary | 05:15:31.335 | 05:17:21.460 |
| mise exited 0 | 05:15:31.358 | 05:17:21.476 |

The second request waited 128.602 s before Bun started, which was 0.301 s after the first request exited. No overlap was observed. These runs establish the requested serialization and passing suite at this revision, not a guarantee against arbitrary future host pressure; host pressure itself was not measured.

## Reproduction

Run the following command concurrently in two terminals in the prepared checkout. This is the timestamping wrapper used for the trial; it preserves `mise run test`'s exit status and does not replace `heavy` or Bun:

```sh
HEAVY_SLOTS=1 python3 -u -c 'import datetime, subprocess, sys
def stamp(text):
    print(datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds"), text, flush=True)
stamp("REQUEST mise run test")
p = subprocess.Popen(["mise", "run", "test"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
for line in p.stdout:
    stamp(line.rstrip())
status = p.wait()
stamp("COMPLETE status=" + str(status))
sys.exit(status)'
```

All trial processes completed. No resident server or external deployment was started.
