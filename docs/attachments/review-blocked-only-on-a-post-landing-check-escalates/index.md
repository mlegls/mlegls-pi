# Rehearse post-landing review obligations

Use the real reconciler, Git integration and vault tracker in a disposable `/tmp/rc-setup-*` repo. Fake BB provides the reviewer persona; no sign-in, live deployment or package registry access is needed. The fixture starts at a ready review with `docs/attachments/review.md` committed.

```sh
bun lib/reconcile/setup-fixture.ts new --review
```

For each case, start a fresh target, set `ROOT` to the printed path and submit the whole report, including its status and fenced YAML, via `bun lib/reconcile/setup-fixture.ts turn "$ROOT" "$REPORT"`. Use `bun lib/reconcile/setup-fixture.ts status "$ROOT"` to read the resulting landing, log and exceptions, and `bun lib/reconcile/setup-fixture.ts issue "$ROOT"` to read the issue Result. After each run, use `bun lib/reconcile/setup-fixture.ts stop "$ROOT"`.

The first three cases transcribe the historical reviews into the explicit handoff format. The checks refer to their original targets; this rehearsal only exercises the reconciler's handling of them.

## Observed

Migration, publishing and mirror recovery all landed without exceptions. The issue Result and reconciler log showed two, one and three pending checks respectively. The mixed review raised `review blocked`; it did not land or record the deferred check as accepted.

## Migration rehearsal on main

Source: @thread:thr_ihbpyrp6s2#msg=39367. Expect a landing without an exception, with each check in the log and under **Pending post-landing checks** in the issue Result.

````text
needs-input

```yaml
summary: Migration rehearsal on main
stories:
  - story: "Changed registered migrations trigger a fresh production-copy rehearsal before staging deploy."
    outcome: unobservable
  - story: "Candidates whose registered migrations match production skip rehearsal."
    outcome: unobservable
evidence: {path: docs/attachments/review.md, visual: false, shots: []}
postLanding:
  - "Re-enable lint.yml and dispatch staging-only on main with a changed registered migration (or no green production-delivery status), then with none. Inspect gh run view <id> --json headSha,jobs: rehearse-migrations must precede deploy-staging on the first run and be skipped on the second."
  - "On the first dispatch, confirm the called refresh-staging.yml gets its environment secrets and its inputs-based concurrency does not deadlock against cloud-delivery."
```
````

## Trusted npm publishing

Source: @thread:thr_ihbpyrp6s2#msg=40257. Expect a landing without an exception, with each check in the log and under **Pending post-landing checks** in the issue Result.

````text
blocked

```yaml
summary: Trusted npm publishing
stories:
  - story: "Local preview selects only versions absent from npm."
    outcome: held
  - story: "A mirror push publishes core 0.2.1 with npm provenance."
    outcome: unobservable
evidence: {path: docs/attachments/review.md, visual: false, shots: []}
postLanding:
  - "After npm trusted-publisher setup, verify the matching mirror push run publishes @mmon-co/ncept-core@0.2.1 with provenance and that rerunning it skips all five versions."
```
````

## Public mirror recovery

Source: @thread:thr_ihbpyrp6s2#msg=40507. Expect a landing without an exception, with each check in the log and under **Pending post-landing checks** in the issue Result.

````text
blocked

```yaml
summary: Public mirror recovery
stories:
  - story: "Recovery fast-forwards the seeded mirror and carries the Publish workflow."
    outcome: held
  - story: "A later landing fast-forwards the recovered mirror."
    outcome: held
  - story: "Public main fast-forwards on recovery and on a later landing."
    outcome: unobservable
  - story: "GitHub starts Publish on the recovery push."
    outcome: unobservable
evidence: {path: docs/attachments/review.md, visual: false, shots: []}
postLanding:
  - "Confirm the public main recovery tip descends from 0ad57c642."
  - "Match a Publish open packages push run to the exact recovery tip."
  - "Confirm the next mirror-changing landing advances public main by fast-forward."
```
````

## Mixed review

Include `postLanding` alongside a failed story to exercise the mixed-review guard. Expect `review blocked`, no landing and no accepted check in the log or issue.

````text
blocked

```yaml
summary: Mixed review
stories:
  - story: "The local preview packs versions already published."
    outcome: failed
  - story: "A mirror push publishes with provenance."
    outcome: unobservable
evidence: {path: docs/attachments/review.md, visual: false, shots: []}
postLanding:
  - "After landing, verify npm provenance on the published core version."
```
````
