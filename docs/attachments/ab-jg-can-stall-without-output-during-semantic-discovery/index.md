# First-use CLI drive: `ab jg` deadline

## Predicted before opening the changed CLI

- An explicit semantic query against a hanging `jg` should stop near `--deadline 2` seconds, report elapsed time and the deadline, suggest `ab grep` for exact search, and exit 2 (incomplete), rather than hang indefinitely.
- `ab jg --help` should explain the default 180-second wall-clock deadline, `--deadline SECONDS`, and `0` to disable it.
- A repository-wide query should get the same bound as a narrower query; the reported failure should not claim an indexing/provider diagnosis.

## Setup plan (before CLI use)

Local CLI in this checkout; no server, browser, credentials, seed or persistent target. Use `./bin/ab` instead of PATH `ab` (which points at the canonical checkout). The implementer's authorized reproduction replaces this checkout's `bin/jg` temporarily with a sleeping stub, then restores it; this is a simulated hung dependency, not a live search. The actual target is this worktree's `./bin/ab`; readiness will be established by `./bin/ab jg --help` and the stubbed command returning.

## Session record

Tested revision: `a7c642f` (`ab-jg-can-stall-without-output-during-semantic-discovery-drive`). Persona: CLI user explicitly invoking `ab jg`. Target: this checkout's `./bin/ab`; PATH `ab` pointed to `/Users/mlegls/dev/mlegls-pi/bin/ab`, so was not used. No deployment, service, credentials, seed or persistent data. `./bin/ab jg --help` exited 0 and displayed the changed help, establishing the entry point was ready. A sleeping shell stub temporarily stood in for this checkout's `bin/jg` for the remaining commands. The original executable was restored after each trial; tracked sleep children were absent afterward. No live provider/index query was attempted.

| Action | Observation | Outcome |
| --- | --- | --- |
| `./bin/ab jg --help` | Explains default `180`, `--deadline SECONDS`, `0` indefinitely, child kill on expiry, exit `2`, exact-search fallback; exits 0. | Help claim held. |
| Stub `jg` as `#!/bin/sh` writing its PID/argv then `exec sleep 300`; `./bin/ab jg --deadline 2 'q' .` | `jg "q": 2.0s, deadline 2s, killed before a result; use ab grep for exact search`; exit 2; shell wall time 3.599s. Stub received `--json`, `--max-source-bytes`, `8192`, `q`, `.`; not `--deadline`. Stub process absent after command. | Bounded failure, message, suggestion, exit code, flag ownership held against a simulated hang across repository root. |
| Same sleeping stub; `./bin/ab jg 'q' ab --deadline 1` | `jg "q": 1.0s, deadline 1s, killed before a result; use ab grep for exact search`; exit 2; shell wall time 2.267s. | Narrower root also bounded; option accepted after root. |
| Same stub; externally bound `timeout -k 1 3 ./bin/ab jg --deadline 0 'q' .` | No `ab jg` completion line; external timeout exited 124 after 3.023s. Child absent after cleanup. | `0` did not impose a short deadline; indefinite behavior cannot be observed exhaustively. |
| Same stub; externally bound `timeout -k 1 3 ./bin/ab jg 'q' .` | No `ab jg` completion line; external timeout exited 124 after 3.012s. Child absent after cleanup. | Consistent with documented 180s default, but actual 180s expiry was not observed. |

### Expectations (prediction → encounter)

- **Met:** explicit 2s limit yielded incomplete exit 2, elapsed/deadline line and exact-search suggestion, rather than waiting on `sleep 300`. Its wall time exceeded the displayed deadline by about 1.6s.
- **Met (documentation):** help described 180s default and 0-off mode. **Partly observed:** an externally stopped 3s run did not trigger either deadline; no 180s wait was performed.
- **Met for tested limits:** both `.` and `ab` roots expired, without alleging any indexing or provider cause. This does not establish the real semantic search's behavior under load.
- **Formed while using, met:** help said `--deadline` would not go to upstream `jg`; captured stub argv excluded it.

### Frictions

- With a stubbed hang the CLI is silent until the deadline; the new behavior gives a prompt *terminal* failure but not progress. For `--deadline 2`, shell wall time was 3.599s, not 2s (and 1s elapsed in 2.267s). A caller budgeting tightly should allow wrapper startup and output-drain overhead.
- Reproducing the failure safely requires substituting an upstream executable; the normal command would use saved credentials and send repository content to a configured provider. This drive did not exercise that path.

### Replayable checks (not tests written here)

1. From this checkout, replace only `bin/jg` temporarily with a script that records `"$@"` and `"$$"`, then `exec sleep 300`; restore it in a shell `EXIT` trap and clean only that PID if still alive. Invoke `./bin/ab jg --deadline 2 'q' .`. Accept exit 2, a completion line containing `jg "q"`, numeric elapsed time near 2s, `deadline 2s`, a killed/incomplete indication, and `use ab grep for exact search`, with the child PID no longer running. Recorded argv must exclude `--deadline`.
2. With the same stub invoke `./bin/ab jg 'q' ab --deadline 1`. Accept exit 2 and `deadline 1s` in the line; compare this to root `.` to catch root-dependent unbounded hangs.
3. With an external 3s timeout invoke `./bin/ab jg --deadline 0 'q' .`. Accept that the external timeout fires first, not an internal deadline. Use an external guard and kill any owned stub PID. For the default 180s limit, a separate clock-controlled or safely externally supervised 180s check should accept exit 2 and `deadline 180s`; this drive did not wait for it.
4. Invoke `./bin/ab jg --help`. Accept exit 0 and documentation for default 180s, override seconds, 0 off, incomplete exit 2 and exact-search fallback.

Nonvisual CLI evidence; no screenshots. The actual stall cause and live provider path remain outside this controlled encounter.
