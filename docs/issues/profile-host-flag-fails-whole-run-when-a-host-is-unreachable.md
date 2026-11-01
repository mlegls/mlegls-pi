---
stage: "ticket"
assignee: "agent"
priority: 3
author: "session:thr_ae8q9yrxnv"
---
idea: efficiency audit 2026-11-02 (@thread:thr_ae8q9yrxnv). The Mac was unreachable, so `bun lib/profile.ts --project concept --host s-macbook-pro --since …` failed outright (`--host s-macbook-pro failed (255): ssh: connect … Connection timed out`, `lib/profile-project.ts:79`) and printed no local rows either. The audit reran without `--host`; an unattended run that didn't would have lost the whole profile.

ticket: when a `--host` can't be reached (ssh exit 255), print a warning naming the host and reason, mark the host unaudited in the output header and in `--evidence`'s `index.md` and `query.json`, and continue with the remaining hosts. A remote that runs but fails still errors as today.

Acceptance: a test with an unreachable alias returns the local rows plus a header line "host <alias> unreachable: … (unaudited)".
