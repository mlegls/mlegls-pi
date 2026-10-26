# Independent host-doctor drive

## Setup and predictions

Tested revision `006791eb` on Beelink, 2026-10-26. CLI-only; no rendered UI. Owned entry point: `bun lib/doctor.ts` in this drive worktree. Live checks use existing bb metadata and authenticated CLI alternatives, with the default agent directory (no inherited `PI_CODING_AGENT_DIR`). No live package, credentials or stamp was changed. Disposable target: `/tmp/doctor-drive-0fRGpU`.

Before story runs I predicted:

1. A normal check names current host gaps individually, without secret values — **met**.
2. With the documented requirements satisfied, a disposable check exits zero silently — **met**, with mocked Sentry authentication described below.
3. Renaming only disposable pi-processes names the package and exits nonzero; restoring recovers — **met**.
4. Repeated daily reporting on Beelink leaves at most one attention item per gap — **met for the existing daily-stamped state**, fresh reporting remains unobservable.
5. The host-setup path runs the doctor on machine moves — **not met/unobservable**: the guide supplies no host-setup entry, and the implementer packet explicitly says the external agents-apply.sh was not changed.

A preliminary discovery invocation `bun lib/doctor.ts --help` preceded these predictions. It exited 1 with `host doctor failed; check pi settings, bb access and tracker availability`, rather than help. This is not acceptance evidence.

## Actions and observed results

- Live `bun lib/doctor.ts`: exit 1, exactly `missing credential: SENTRY_AUTH_TOKEN`. No values appeared. This matches the inherited known host state.
- Read the user guide and its public requirements JSON (not implementation). Created a disposable agent settings file naming `../pi-processes` and an absolute npmCommand pointing to a symlink of the real bun. Existing PATH supplies the six required CLIs. A temporary sentry-cli executable prints a synthetic authenticated user (`doctor@example.invalid`); existing GitHub authentication/metadata is retained. This is a simulated healthy Sentry state, not a real credential repair.
- With temporary package directory present, `PI_CODING_AGENT_DIR=/tmp/doctor-drive-0fRGpU/agent PATH=/tmp/doctor-drive-0fRGpU/bin:$PATH bun lib/doctor.ts`: exit 0, no output.
- Renamed only the disposable package directory away and repeated: exit 1, exactly `missing pi package: ../pi-processes`.
- Restored it and repeated: exit 0, no output. No live sessions were disrupted.
- Changed the disposable absolute npmCommand to `/tmp/doctor-drive-0fRGpU/not-installed`: exit 1, exactly `missing settings path: npmCommand (/tmp/doctor-drive-0fRGpU/not-installed)`.
- Ran live `bun lib/doctor.ts --daily` twice: both exit 0 with no output. The inherited stamp means this exercises suppression, not first-time report creation. The existing human-assigned Sentry attention ticket remains [host-gap-beelink-e712a02b83-credential-sentry-auth-token-6cbb42aed7](../../../issues/host-gap-beelink-e712a02b83-credential-sentry-auth-token-6cbb42aed7.md).
- Deleted the disposable directory after the drive. No servers, browser tabs, background processes or external deployment resources started.

## Frictions and acceptance limits

- Machine-move integration could not be reached through the supplied entry point: it reaches a checker, not a host setup flow. The implementation packet acknowledges that the external host-setup script is unchanged. This remains owned by the active [ticket](../../../issues/managed-process-tool-missing-on-beelink.md), not waived as a caveat.
- Daily checks are session-triggered, not a daily timer on inactive enrolled hosts. The guide says so explicitly. This is narrower than the ticket's daily-on-every-enrolled-host wording; no contract decision was supplied to this driver.
- Daily first-time filing and deduplication after another due check were not observed independently because the live stamp was already claimed. I did not erase shared host state.
- The guide does not document a way to list effective requirements from the CLI, and --help does not provide help; using the linked requirements JSON was sufficient.

## Replayable checks for review

1. Healthy check: temporary agent settings and package target, listed CLIs on PATH, required metadata or authenticated alternatives; expect exit 0 and no stdout/stderr.
2. Remove only the local package target; expect exactly one missing-package line and exit 1; restore and expect silent exit 0.
3. Name a nonexistent absolute npmCommand in settings; expect one settings-path line containing the setting name and path, exit 1.
4. Arrange an owned fresh reporting target and a known missing credential. Run a due daily check twice, then another due check; expect exactly one human attention item per host/gap. Current live drive proves only already-stamped suppression.
5. Run the actual host machine-move setup with a known gap; expect the doctor to execute and surface that gap. No runnable setup entry was supplied or documented here.
6. Observe an enrolled host without sessions for more than 24h; a literal daily guarantee requires an attention item without starting a session. Current guide promises only a check at the next session.

No source, diffs, tests or fixtures were inspected; no product repair or repository test suite was run.

## Review (appended)

Read `lib/doctor.ts`, `lib/doctor-start.ts`, the bb session hook and the guide against the ticket. No defects found in the diff; no repairs made.

- Replayed check 4 with a disposable tracker (`getTracker(tmpdir)`, host `hostA`): reporting two duplicate package gaps plus one CLI gap, twice, produced exactly two tickets (one per gap). Fresh-report creation and dedupe: **held**. Live `bun lib/doctor.ts` on this head: exit 1, `missing credential: SENTRY_AUTH_TOKEN` (real gap; its open human ticket already exists).
- Daily trigger is session start, rate-limited per host to 24 h. bb automations run scripts on the bb server host only, so a per-host timer is not available through them; the Beelink acceptance (daily run files at most one item per gap) is met. A host with no sessions runs no workers, so no tool gap bites there. Accepted limitation, stated in the guide.
- Machine-move: the host-setup path is `scripts/agents-apply.sh` in the separate `~/.config/system-config` repo, which this change does not touch. Not invoked on a machine move; unresolved, see the report.
- `mise run test:affected` does not exist in this repo; the change adds no tests.

