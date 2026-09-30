# ab resource-list drive

## Predictions (before opening product)

From the ticket and README, as a CLI user I expect:

1. `ab check list` returns a complete JSON array even with many historical checks; piping to `jq length` or Python `json.load` succeeds rather than stopping at 65536 bytes. I should be able to inspect the queue without parsing partial objects.
2. Each check receipt includes id, kind, status, command, cwd, times, code, reason and log (where applicable), not `env` or its values. A deliberately supplied environment value should not appear in the list.
3. `ab check list --status running,queued` returns only those statuses, with an empty array if neither exists. Filtering should avoid scanning a full historical list downstream.
4. `ab service list` has the same compact JSON shape, environment omission and status filter. Starting my own foreground service should make a filter for `running` find it, then stopping it should move it out of that filter.
5. README says an existing daemon needs a safe restart to use the current version. Setup handoff is null, so checkout ownership and entry point remain to establish before driving; I must not mistake the globally installed `ab` or an inherited daemon for this checkout's product.

## Setup and encounter

Predictions above were committed as `b242676` before invoking the product. Tested product revision: `0b9ed71`. Setup handoff was null. Required deployment: local CLI; owned target: this worktree's `./bin/ab` with `AB_STATE=$PWD/.wm/ab-drive-state`, not the inherited `ab` on PATH (which points at the canonical checkout) or its inherited per-user `AB_STATE`. Persona: local CLI user, no authentication. Seed: empty isolated daemon state; no inherited records or credentials. Entry: `AB_STATE="$PWD/.wm/ab-drive-state" ./bin/ab check list` and corresponding service commands from this worktree. Dependencies were already installed in the worktree. `./bin/ab daemon status` responded `no jobs`; checkout CLI `check --help` exposed `list [--status running,queued,done]`, establishing a working CLI and isolated daemon before encounter. Readiness is the daemon's command response, not a URL. No server is required to expose the CLI. Stopped the one service by id and shut down the isolated daemon after the final read; neither the inherited daemon nor a shared service was stopped.

This was a CLI-only journey; no rendered UI or screenshots.

## Frictions, expectations and replayable checks

### Actions and observations

- Ran 18 short checks sequentially with a synthetic 7,000-character `AB_DRIVE_SENTINEL` in each submission environment. The raw check-list pipe parsed with `json.load` (18 records, 9,903 bytes) and `jq length` returned 18. Keys in completed receipts: `id`, `kind`, `status`, `command`, `cwd`, `submitted`, `started`, `ended`, `code`, `log`; no `env` key or sentinel text. A sample completed receipt contained the command `sh -c 'exit 0'`, exit code 0, checkout cwd and a log path. `--status running,queued` returned `[]` when none were active.
- Continued submitting short checks to grow the *new compact output* past the old 65,536-byte cutoff. At an intermediate snapshot, `./bin/ab check list | python3 -c 'import json,sys; s=sys.stdin.read(); a=json.loads(s); print(len(s.encode()),len(a))'` returned `67106 122` through a real pipe. Final snapshot after the three concurrent checks: **74,806 bytes, 136 records**, every record `done`, no `env` key; both `json.load` and `jq length` parsed successfully (`jq`: 136). This exceeds the original failure threshold while retaining all 18 + 115 + 3 checks.
- Started three `ab check -- sh -c 'sleep 9'` callers concurrently. During the work, `ab check list --status running,queued` parsed to three receipts, statuses `running`, `running`, `queued`; no `env` key. After all callers exited, the same filter parsed to `[]` (`jq length`: 0). These were live jobs in the isolated daemon, not fixture rows.
- Started one foreground service through `ab service start --ttl 120 -- sh -c 'printf ready > .wm/ab-drive-service-ready; exec sleep 100'`; receipt id `860921e6-1cc9-458d-880b-64a48e5093e5`. Confirmed readiness by the marker file, not merely the start receipt. With a synthetic `AB_DRIVE_SERVICE_MARKER` in the environment, `ab service list --status running` parsed to one running receipt, fields `id`, `kind`, `status`, `command`, `cwd`, `submitted`, `started`, `log`, with no marker text. `--status queued` returned `[]`. Explicitly stopped that id through `ab service stop`; unfiltered list parsed to one `done` receipt with `reason`, `code`, `ended`, still no `env`; `--status running` returned `[]`, `--status done` returned one.

### Expectations

1. Complete historical JSON: **met** at 74,806 bytes and 136 records through a real pipe, beyond the 65,536-byte cutoff.
2. Compact receipts without environment: **met** for both check and service lists. Absent `reason` on normal check completion was expected as an inapplicable field, not a defect.
3. Check active-status filter: **met** for running and queued jobs together and for the empty terminal state.
4. Service filter and lifecycle: **met**; explicit stop yielded a `done` receipt with stop reason.
5. Checkout-owned target: **met** after overriding both the PATH binary and inherited daemon-state selector.

### Frictions

- Null setup handoff required manually separating canonical `ab` on PATH and the per-user default daemon from the changed checkout. The README warns about daemon version but does not provide an explicit checkout-isolated drive recipe; the CLI behaved normally once `AB_STATE` and `./bin/ab` were used.
- The service start receipt is not readiness; I had to observe a separate marker produced by the foreground process before inspecting its running record, as the CLI docs correctly warn.

### Replayable checks I wondered about

1. Can output longer than the old cutoff survive a pipe? In an isolated `AB_STATE`, run enough short checks so the compact JSON exceeds 65,536 bytes, then pipe `./bin/ab check list` directly into Python `json.load` and `jq length`. Accept a valid complete array whose count equals submitted checks and whose raw byte count exceeds 65,536; reject a partial JSON error or silent dropped receipts.
2. Does `env` leak? Submit checks and a service with distinct synthetic marker variables, then parse both unfiltered lists. Accept that no receipt has an `env` key and neither raw output contains either marker; other receipt fields remain available.
3. Does active filtering reflect a real queue? Start three checks that sleep long enough to overlap in the two-slot daemon, query `check list --status running,queued`, and accept only matching statuses including at least one `queued`; wait for all callers, query again and accept `[]`.
4. Does service filtering track a stopped process? Start a foreground service that writes a readiness marker and sleeps; once ready, accept one matching `running` receipt in `service list --status running`. Stop its id, then accept none in `--status running` and one with `status: done` in `--status done`; no environment values in either receipt.

## Review and automated replay (2026-09-30)

Reviewed the delta from `dd0836cf8a49ce83d92a5c7af71bd25e4963ce21` alongside the first-use record, CLI exit path, daemon receipt projection and resource lifecycle. No product defect found in this bounded pass; product behavior is unchanged by review.

`ab/resources.test.ts` now replays checks 1–4 through the checkout CLI with an isolated daemon and actual OS stdout pipes. Sixteen real historical submissions carry longer harmless argv so the compact JSON exceeds 65,536 bytes without 136 CLI round trips; the replay checks the complete count, commands, terminal receipts and environment omission. Three live callers hold the two slots until a release file is written, proving `running,queued` and the empty completed filter without a fixed job-duration race. A service writes a readiness marker, appears in `running`, then moves to `done` with its stop reason and timestamps. All five predictions remain met; no driver check was dropped.

Final replay: `ab check -- bun test ab/resources.test.ts lib/resources` — **9 passed, 0 failed**, including the existing resource-host and CLI sharing/nesting checks (execution `5c2ea3c2-2557-43a7-b4fc-cd75917ce978`). The first test attempt exposed only a fixture-path mismatch on macOS (`/var` versus `/private/var`); the fixture now canonicalizes its temporary cwd before comparison. Both attempts shut down their isolated daemons; the successful replay explicitly stopped its service and released all callers.

Frictions disposition:
- Null setup handoff / checkout isolation: recorded with the existing separate `stage: idea` owner, [supervised-study-drive-lacks-setup-handoff](../../issues/supervised-study-drive-lacks-setup-handoff.md). No expansion of this ticket.
- Start receipt versus readiness: handled here by retaining the process-written readiness marker in the automated replay; the documented distinction is correct, not a product defect.

Final claims: complete machine-readable check list **held**; compact receipts without environment values **held**; check and service status filters **held**. Evidence remains CLI-only, with no screenshots or remaining review-owned processes.
