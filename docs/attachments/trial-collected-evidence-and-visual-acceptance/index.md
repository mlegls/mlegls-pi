# Collected evidence and visual acceptance trial

The trial is not complete. No post-restart delivery has been counted or accepted. This packet currently records coordination and the pre-restart baseline; the three product packets will stay with their deliveries.

## Preparation

Starting ref: `6caba304b1cd64ef525331bf7a372c434ebedcb1`. The shared daemon was PID `66677` at 2026-09-30 14:08 UTC. [Preflight inventory](preflight.json) records only active jobs and their owners, not historical or secret-bearing job input.

Current owners were rediscovered from those jobs: Concept `mail/c7a4ad76`, mlegls-pi `mail/b9b312e4`. Concept replied (`muo6kryj-jgkdih`, 14:08:35 UTC), confirming no integration and no unapplied commands. Its nominated rendered deliveries are:

- [[projects/concept/issues/name-things-by-their-names-not-ids]]: already in drive; retain that collector, require its current `stories` list and `evidence` object, and obtain actual image judgment. Do not duplicate the encounter merely to start a fresh worker.
- [[projects/concept/issues/fix-small-application-state-and-error-defects]]: still in implement; its collector should start after the restart.

The nonvisual delivery is not nominated yet. No duplicate work was claimed or dispatched.

The active roster at preparation is unchanged: collector `openai-codex/gpt-6.1-sol:high`, fallback `anthropic/claude-sonnet-5-5:high`; visual reviewer `anthropic/claude-opus-5-5:medium`, fallback `openai-codex/gpt-6.1-sol:high`. Record actual executions, not these preferences, when measuring. A visual fallback to the collector's model would not establish this ticket's stronger-model comparison.

Restart is not yet authorized by both owners. Shutdown also terminates running `ab service` and `ab check` process groups; job recovery does not restore those environments. At 14:11 UTC eight services were running: names drive (three), small-defects implementation (three), mission-history implementation (two). Two checks were running and two queued across the two repositories. Owners must arrange encounter/setup boundaries, not merely a gap between integrations. Concept was notified; no service, check or daemon was stopped by this observer.

The next restart must launch from `/Users/mlegls/dev/mlegls-pi`, record its actual code revision and new PID, and reconcile each owner's saved commands. `e2f877c` (`--pick`) is an ancestor of the starting ref. Canonical checkout had unrelated dirty files at preparation; they are not this observer's changes.

## Measurements to finish

For each delivery, link the final committed packet, integration ref and original screenshot files; verify the files still exist in the owner's integrated repository after every associated worker/worktree is retired. Record collector and reviewer model/effort from their actual sessions. Rendered deliveries need a transcript-backed opening of the images and a committed judgment, not just a routing receipt or DOM check.

Keep Jev semantic navigation, direct/manual browser interaction, deterministic Playwright replay and strong-model image judgment separate. Record what each actually establishes. The prior disposable smoke's fixture image and mocked worker transport count for none of these live measurements.

Count completed encounters, setup failures, parent interventions, missing states requested and defects found. Also count avoidable handoffs, repeated setup and duplicated judgment. A reviewer who repairs, re-drives and refreshes evidence directly is a success. Identify which stages bought a new observation or judgment, and which could be collapsed.

Accepted completion cost should include implementation, collector, reviewer, retries/repairs and attributable supervisor work where available. Sum harness-recorded assistant `usage.cost.total` only with its limits explicit: nominal cost is not an invoice or subscription consumption; tool-side Jev/model calls and shared parent work may be unavailable. Do not label a collector-only total as accepted completion cost. No permanent telemetry or routing-default change is part of the trial.

## Reproduction

No deployment, auth or seed is required for this observer packet. Product setup remains the delivery owner's responsibility. Read this committed packet and the preflight inventory directly:

```sh
ab read docs/attachments/trial-collected-evidence-and-visual-acceptance/index.md
jq '{daemonPid, daemonRestarted, collectorPreference, visualPreference, jobs}' docs/attachments/trial-collected-evidence-and-visual-acceptance/preflight.json
```

Before an agreed restart, inspect current (not this historical) state:

```sh
ab daemon status > /tmp/trial-daemon-current.jsonl
jq -c 'select(.status == "running") | {id, owner: .input.owner, children: .state.children}' /tmp/trial-daemon-current.jsonl
ab check list --status running,queued
ab service list --status running,queued
```

No processes or external resources were started by this observer.

## Friction

`ab mail c7a4ad76` warned that it could not confirm a live subscriber; Concept's actual reply established delivery in this instance. Existing owner: [[projects/mlegls-pi/issues/make-undeliverable-mail-status-visible-to-scripts]]. Do not treat the warning alone as proof that the owner is dead.
