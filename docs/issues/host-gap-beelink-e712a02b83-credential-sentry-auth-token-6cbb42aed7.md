---
stage: "ticket"
assignee: "human"
author: "host-doctor:beelink"
---
Host: beelink

missing credential: SENTRY_AUTH_TOKEN

Set SENTRY_AUTH_TOKEN in bb env, or in Infisical (secret-management prod/concept) with this host's machine identity at ~/.config/infisical/agent.env, or authenticate with sentry-cli. Values must not be included in this issue.

Found by the pi host doctor. Run bun lib/doctor.ts in the mlegls-pi checkout after repair.
