---
stage: "done"
assignee: "agent"
priority: 3
author: "session:thr_ae8q9yrxnv"
---
idea: efficiency audit 2026-11-02 (@thread:thr_ae8q9yrxnv). The Mac was unreachable, so `bun lib/profile.ts --project concept --host s-macbook-pro --since …` failed outright (`--host s-macbook-pro failed (255): ssh: connect … Connection timed out`, `lib/profile-project.ts:79`) and printed no local rows either. The audit reran without `--host`; an unattended run that didn't would have lost the whole profile.

ticket: when a `--host` can't be reached (ssh exit 255), print a warning naming the host and reason, mark the host unaudited in the output header and in `--evidence`'s `index.md` and `query.json`, and continue with the remaining hosts. A remote that runs but fails still errors as today.

Acceptance: a test with an unreachable alias returns the local rows plus a header line "host <alias> unreachable: … (unaudited)".

## Result

done — the change holds. `profile --host` now warns about an unreachable host, marks it unaudited, and continues with the remaining hosts. A remote that ran and failed still errors.

I checked the "ran and failed" case myself: a stand-in `ssh` on PATH ran the sent command locally under a `bun` that exits 255. `bun lib/profile.ts --project zz-none --since 2026-11-02 --host fake` printed `error: --host fake failed (255): collector-broke` and exited 1, with no unaudited warning.

- **Code:** I found nothing to repair in `lib/profile-project.ts`.
- **Test:** I added `lib/profile-project.test.ts`, since the ticket's acceptance asks for one. It passes: an `.invalid` alias through `projectReport` returns a first line matching `host … unreachable: … (unaudited)`.
- **Not a test:** the ran-and-failed case. `Bun.spawn` finds `ssh` on the PATH from process launch, so an in-process shim has no effect.
- **Filed:** I closed `profile-cli-drive-needs-trusted-remote-failure-target`, because a trusted remote isn't needed to check that case.

```yaml
commit: aafab54c
stories:
  - story: Unreachable host warns, marks header unaudited, and retains local rows
    outcome: held
  - story: Evidence index and query metadata record the unaudited host and reason
    outcome: held
  - story: A remote command that runs but fails remains fatal
    outcome: held
evidence:
  path: docs/attachments/profile-host-flag-fails-whole-run-when-a-host-is-unreachable/index.md
  visual: false
  shots: []
tests:
  - lib/profile-project.test.ts
filed: []
caveats:
  - "The new test makes a real ssh DNS lookup of an .invalid name, about 1 s, and doesn't touch the network when offline."
  - "A host-key failure also counts as unreachable (it exits 255 before the collector starts), so such a host is skipped with a warning rather than failing the run."
  - "--json keeps its row-array output, so the unaudited line goes only to stderr and to query.json."
```

Evidence: [docs/attachments/profile-host-flag-fails-whole-run-when-a-host-is-unreachable/index.md](../attachments/profile-host-flag-fails-whole-run-when-a-host-is-unreachable/index.md)
