---
stage: "done"
assignee: "human"
author: "host-doctor:beelink"
---
Host: beelink

missing credential: SENTRY_AUTH_TOKEN

Set SENTRY_AUTH_TOKEN in bb env, or authenticate with sentry-cli. Values must not be included in this issue.

Found by the pi host doctor. Run bun lib/doctor.ts in the mlegls-pi checkout after repair.

## Result

SENTRY_AUTH_TOKEN now lives in Infisical (secret-management, /concept in dev/staging/prod); the doctor accepts it there since 173c0141 and exits 0 on the Beelink.
