# Host doctor

From the mlegls-pi checkout:

```sh
bun lib/doctor.ts
```

No gaps means exit zero and no output. Each gap produces one line and exit one.
The doctor checks local packages relative to the pi settings file, absolute
settings paths, and the CLI and credential requirements in
[doctor.required.json](../../lib/doctor.required.json). It uses
`PI_CODING_AGENT_DIR/settings.json` when set, otherwise
`~/.pi/agent/settings.json`. Credential checks read bb env key metadata;
Sentry and GitHub also accept the authenticated CLI alternatives in the list.
Credential values and authentication command output are never printed.

The bb extension's session-start hook starts a detached, nonblocking doctor
child on the first session on a host, then at most once per 24 hours. A machine
move (a new or moved host or home directory) means exactly this: it has no
stamp, so its first pi session runs the doctor.
Each host has a separate stamp under `~/.pi/agent/doctor/`
(or the configured agent directory). There is no timer: an inactive host is
checked when its next session starts. Reload pi after installing this change.

`bun lib/doctor.ts --daily` invokes the same rate-limited reporting path.
It files one human-assigned tracker ticket per host and gap, using deterministic
slugs, through the mlegls-pi tracker writer. An existing open ticket is left
alone; a recurring resolved gap reopens its ticket. Repairing a gap does not
automatically close its ticket. The timestamp is claimed before checking, so
even a failed check does not retry on every session.

## Disposable first use

Point `PI_CODING_AGENT_DIR` at a temporary directory containing a
`settings.json` with a local package path. Create the target, run
`bun lib/doctor.ts`, rename the target away, then run again. The second
run names the package and exits nonzero. Restore it and supply the listed CLIs
and either bb env keys or authenticated alternatives: the run is silent and
successful. This does not require renaming a live package checkout.

For reporting trials, call exported `reportGaps(gaps, tracker, host)`
with `getTracker(tempDirectory)` and a disposable directory containing
`docs/issues/`. Repeating a report leaves one ticket per host/gap and
exercises the real tracker writer without creating live host alerts.
