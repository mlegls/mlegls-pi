# Host doctor — implementation first use

CLI-only journey; no screenshots. Tested the implementation tree committed with
this packet, based on de93abed727e9f9cfa33c17059b13cb4ea492b36, on Beelink
on 2026-10-26. These are implementer observations, not independent acceptance.

## Setup and entry point

From the committed mlegls-pi checkout, run:

```sh
bun lib/doctor.ts
```

No deployment, seed or browser is required. The live run reads the host's pi
settings, bb env key metadata and existing CLI authentication; it does not
change credentials. Required tools and alternatives are committed in
[doctor.required.json](../../../lib/doctor.required.json).
The [guide](../../guide/host-doctor.md) describes disposable-fixture setup and
the reporting entry point.

## Observations

- Live Beelink CLI: exit 1, exactly `missing credential: SENTRY_AUTH_TOKEN`.
  No credential values or authentication output appeared.
- Disposable HOME, pi settings and PATH: with all six listed tools and bb
  key-name metadata present, the actual CLI exited 0 with empty stdout/stderr.
- In that fixture, settings named `../../dev/pi-processes`.
  Renaming only the temporary target produced exit 1 and exactly
  `missing pi package: ../../dev/pi-processes`.
  Restoring it restored the successful run. No live package directory moved.
- Mocked authenticated Sentry and GitHub command responses satisfied the
  credential requirements with no bb keys.
- The daily CLI in the fixture created a host stamp. Removing the package
  before a second immediate daily run caused no further check or stamp change.
- Invoking the startup helper in a separate fixture process returned
  successfully; its background child wrote the stamp and released its lock.
- Repeated reporting, including a duplicate gap in one invocation, against a
  disposable tracker with the real tracker writer left exactly one ticket.
- Live `bun lib/doctor.ts --daily && bun lib/doctor.ts --daily`
  succeeded silently and left one human-assigned ticket:
  [[projects/mlegls-pi/issues/host-gap-beelink-e712a02b83-credential-sentry-auth-token-6cbb42aed7]].
  Its host stamp is now present under the live pi agent directory.

The fixture experiment used a temporary diagnostic program, not a new
permanent test. Fixture directories and background children were cleaned up.

## Regression checks

- `bun run typecheck`: passed.
- `bun test lib/tracker.test.ts`: 3 passed, 0 failed.
- `git diff --check`: passed.

## Operational boundary

The agreed daily trigger is session-driven, not a timer: inactive enrolled
hosts are checked at their next pi session. The Mac has not been driven here.
The maintainer may additionally invoke `bun lib/doctor.ts` from
system-config's `scripts/agents-apply.sh`; that other repository was
not changed.
