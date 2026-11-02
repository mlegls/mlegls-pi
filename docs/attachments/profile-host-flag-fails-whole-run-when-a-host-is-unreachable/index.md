# Unreachable profile host: independent CLI encounter

## Setup and predictions (before first use)

- Tested revision: `5980f994aa49a132f2939e68cf6098b260831d5e`.
- Deployment: local CLI in this ticket-owned `profile-host-flag-fails-whole-run-when-a-host-is-unreachable-drive-2` checkout on `beelink`; clean starting worktree confirmed. No server, deployment selector, credentials or seeding required. Persona: owner reading existing session history and BB database. No history mutations authorized or needed.
- Entry: `bun lib/profile.ts --project mlegls-pi --since 2026-11-02 --last 3 --by-thread --host profile-unreachable.invalid --evidence .wm/profile-unreachable-evidence`.
- Prediction P1: the unreachable alias produces a host-named warning with the SSH reason and `(unaudited)`, but exits successfully and still lists local threads.
- Prediction P2: the evidence index and query metadata both explicitly preserve that the host was unaudited and why.
- Prediction P3: a run without the remote alias still succeeds, letting me distinguish local-history readiness from remote failure.
- Prediction P4: a remote that successfully starts but fails should still fail the overall run. No reachable remote setup is supplied; I will check availability only through the CLI's real host surface, without substituting fake SSH or reading implementation.

## Encounter

1. Ran the supplied entry from this checkout. Readiness established by completion in three seconds, exit 0. stderr warned `Warning: host profile-unreachable.invalid unreachable: ssh: Could not resolve hostname profile-unreachable.invalid: Name or service not known (unaudited)`. stdout began with the same host/reason/unaudited line (without `Warning:`), followed by two local `beelink` thread rows. The unavailable host did not discard local results. P1 met.
2. Opened the generated `.wm/profile-unreachable-evidence/index.md` and `query.json` as a user. The Markdown header preserved the exact unaudited line. Query metadata kept `beelink` in `hosts` and the invalid alias in `unauditedHosts`, with the DNS failure in `reason`. P2 met. These are summarized rather than committing history exports containing private session details.
3. Ran the entry without `--host` or `--evidence`. Exit 0 in three seconds; the same two local thread identities appeared. Costs changed as live sessions continued; no fixed-cost equality is claimed. P3 met.
4. Tried a real remote-command-failure encounter using `bun lib/profile.ts --project profile-drive-deliberately-absent-project --since 2026-11-02 --last 3 --by-thread --host beelink`. SSH stopped at `Host key verification failed.`; the CLI marked beelink unaudited and exited 0. This establishes another transport failure path, not a command that started remotely. P4 unobservable, not met or failed. No SSH trust/configuration changes made.

## Outcomes, friction and remaining checks

- Held: unreachable alias warns with host and reason, marks stdout header unaudited, exits successfully, and retains local rows.
- Held: both evidence outputs preserve the unaudited host and reason.
- Unobservable: a remote command that actually starts and fails retains fatal behavior. The reviewer must obtain this evidence before accepting the full ticket; this packet does not waive it.
- Friction: no reachable trusted remote supplied; local `beelink` alias could not establish host trust. Filed outside the execution subtree as [[projects/mlegls-pi/issues/profile-cli-drive-needs-trusted-remote-failure-target]]. No product defect observed in the driven changed path.

Replayable checks:

- C1: Run the entry above against existing local history. Accept exit 0, warning on stderr naming the invalid alias and SSH reason, stdout beginning `host profile-unreachable.invalid unreachable: ... (unaudited)`, and at least one local row after it.
- C2: Open the generated index and query. Accept the same alias/reason and unaudited state in both; local host must remain in the audited host list.
- C3: Repeat without `--host`; accept the same local identities, allowing ongoing-history totals to change.
- C4: With an independently trusted reachable SSH target, provoke an actual remote profile command failure. Accept nonzero overall exit and no classification as unreachable. Current target stopped before command execution, so this check has not been satisfied.

Nonvisual CLI encounter; no screenshots. All three owned processes exited; no servers, tunnels, remote deployments or browser pages were started. No source, diffs, tests or fixtures read; no repository checks run. No repairs made.

## Review (reviewer, head after 85152a2d)

- C4 satisfied without a trusted remote: an `ssh` stand-in on PATH (outside the process) runs the sent command locally under a `bun` that prints `collector-broke` and exits 255. `bun lib/profile.ts --project zz-none --since 2026-11-02 --host fake` printed `error: --host fake failed (255): collector-broke`, exit 1, no unaudited warning. A collector that started and failed stays fatal even at 255 (the start marker distinguishes it). Story 3 held.
- Acceptance's test added: `lib/profile-project.test.ts` (ticket acceptance specifies it): an `.invalid` alias through `projectReport` returns a first line `host … unreachable: … (unaudited)`; passes.
- Not a test: the started-and-failed case, since Bun.spawn resolves `ssh` from the launch PATH and can't be shimmed in-process.
