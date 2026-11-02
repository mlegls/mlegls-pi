# Implementation first use: unreachable profile hosts

## Setup and runnable entry

- Base: `31026c8ce8feb059b0bfbfef8af1a4f99100c4d5`.
- Target: this ticket's worker checkout on `beelink`; CLI only, using the owner's existing local read-only session logs and BB database. No authentication changes, secrets, seed mutations, remote deployment, or resident server.
- Requirements: installed project dependencies, Bun, SSH, and existing local session history. `.invalid` is reserved for names that do not resolve, so this entry does not require an unreachable physical machine.
- Opened successfully from the worker checkout:

```sh
bun lib/profile.ts --project mlegls-pi --since 2026-11-02 --last 3 --by-thread --host profile-unreachable.invalid --evidence .wm/profile-unreachable-evidence
```

The fresh driver can run this same command from its checkout. Evidence is regenerated under `.wm/`; no worktree-local fixture is needed. Local history changes over time, so exact row contents need not match this encounter.

## Observed first use

The command exited 0, emitted a warning on stderr, and began stdout with:

```text
host profile-unreachable.invalid unreachable: ssh: Could not resolve hostname profile-unreachable.invalid: Name or service not known (unaudited)
```

Two local BB thread rows followed (`thr_cy4jmrrd9e` and `thr_dwre28wvm6`, host `beelink`). The generated `index.md` contained the same unaudited header. `query.json` retained the successful local host/database and added:

```json
"unauditedHosts": [
  {
    "host": "profile-unreachable.invalid",
    "reason": "ssh: Could not resolve hostname profile-unreachable.invalid: Name or service not known"
  }
]
```

`--json` retains its existing row-array contract: warning output goes to stderr, while host coverage is persisted in the evidence query. Human-readable reports prepend unaudited host lines.

## Focused checks

- `bun run typecheck`: passed.
- Temporary SSH-shim diagnostic: a collector-start marker followed by exit 1 or exit 255 still caused `remoteProject` to throw `--host running-remote failed (<code>): collector failed`. The private marker was stripped from the error. This distinguishes connection failure from a collector that actually started and failed; this diagnostic used a mock transport, not a live remote.
- No existing profile regression test file or `test:affected` task is present. No permanent tests were added in the implementer role; the fresh driver/reviewer owns acceptance and replay checks.
- No processes or external resources remain running.
