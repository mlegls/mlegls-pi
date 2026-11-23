# Host doctor

```sh
bun lib/doctor.ts
```

Exits 0 silently when clean, or prints one line per gap and exits 1. Checks local packages relative to `PI_CODING_AGENT_DIR/settings.json` (default `~/.pi/agent/settings.json`), absolute settings paths, and the CLI/credential requirements in [lib/doctor.required.json](../../lib/doctor.required.json).

Credential checks inspect BB env key metadata, accepted authenticated CLI alternatives (Sentry, GitHub), and—for entries with an `infisical` mapping—the shared Infisical `secret-management` project via `INFISICAL_TOKEN` or `~/.config/infisical/agent.env`. Secret values and auth command output are never printed.

## Automatic daily checks

The BB extension starts a detached doctor run on the first Pi session on a host (including after a machine move) and at most once per 24 hours thereafter, stamped per host under `~/.pi/agent/doctor/`.

`bun lib/doctor.ts --daily` invokes the same rate-limited path: it claims the stamp before checking and files one human-assigned tracker issue per host and gap (deterministic slug, leaving existing open issues alone and reopening resolved ones if a gap recurs). Fixing a gap doesn't auto-close its issue.

## Disposable check

Point `PI_CODING_AGENT_DIR` at a temp dir with a `settings.json` referencing a temp package path, run `bun lib/doctor.ts`, rename the target away, and rerun to verify exit 1. For reporting checks, call `reportGaps(gaps, getTracker(tempDir), host)` against a temp `docs/issues/`.
