# Collected evidence and visual acceptance trial

One nonvisual delivery is accepted, integrated and retired; both rendered deliveries are still in flight. This is an interim report, not successful completion of the three-delivery trial. The supervisor explicitly authorized ending this observation pass with pending deliveries recorded (`muo6u5rd-vno60e`, 2026-09-30 14:15:53 UTC); the remaining observations belong to the original ticket's follow-up.

## Preparation

Starting ref: `6caba304b1cd64ef525331bf7a372c434ebedcb1`. The shared daemon was PID `66677` at 2026-09-30 14:08 UTC. [Preflight inventory](preflight.json) records only active jobs and their owners, not historical or secret-bearing job input.

Current owners were rediscovered from those jobs: Concept `mail/c7a4ad76`, mlegls-pi `mail/b9b312e4`. Concept replied (`muo6kryj-jgkdih`, 14:08:35 UTC), confirming no integration and no unapplied commands. Its nominated rendered deliveries are:

- [[projects/concept/issues/name-things-by-their-names-not-ids]]: already in drive; retain that collector, require its current `stories` list and `evidence` object, and obtain actual image judgment. Do not duplicate the encounter merely to start a fresh worker.
- [[projects/concept/issues/fix-small-application-state-and-error-defects]]: still in implement at the observation cutoff.

The mlegls-pi owner nominated [[projects/mlegls-pi/issues/ab-edit-block-replace-rejects-sigil-second-anchor]] under `supervise-small-ab-cli-fixes-muo6hjm3`. No duplicate work was claimed or dispatched.

The active roster at preparation is unchanged: collector `openai-codex/gpt-6.1-sol:high`, fallback `anthropic/claude-sonnet-5-5:high`; visual reviewer `anthropic/claude-opus-5-5:medium`, fallback `openai-codex/gpt-6.1-sol:high`. Record actual executions, not these preferences, when measuring. A visual fallback to the collector's model would not establish this ticket's stronger-model comparison.

Restart coordination found eight running services and four running/queued checks across the two projects. Concept held commands and asked four workers for boundaries; the garden/prune driver confirmed one. No service, check or daemon was stopped by this observer.

The mlegls-pi owner then established that a new restart was unnecessary (`muo6ro2z-6p02uc`, repeated as `muo6u5rd-vno60e`). PID `66677` started **13:42:21 UTC**, after the last runtime change to `lib/jobs/supervise.ts` or `lib/report.ts`, **`ccb67674110b0e213562816b6c9bfd2057e89ddb` at 12:19:17 UTC**. `ps -p 66677 -o lstart=,command=` and `git log -1 --format='%H %cI %s' -- lib/jobs/supervise.ts lib/report.ts` confirmed this; those files had no uncommitted changes. `e2f877c` (`--pick`) is included. The owner explicitly substituted this proof for another restart. Concept released all holds at 14:16:15 UTC; this observer sent the same release at 14:16:54 UTC. No setup repetition was needed.

Prompt freshness is separate from daemon freshness. Concept confirmed the evidence handoff landed in `11c8577` before its three carried workers launched (`muo6v1tm-jbmn8g`). Still require their actual current-format final reports; launch timing alone cannot establish an evidence packet.

## Results

### Nonvisual: sigiled second-anchor CLI edit

Product packet: `docs/attachments/ab-edit-block-replace-rejects-sigil-second-anchor/index.md` at closure `a0079b34bd7886fbbd59025f808fa617c1646b5b` in the integrated mlegls-pi repository. The reproduction command below reads that exact Git object even from this older observer branch. [Measurements and lifecycle events](nonvisual.json) preserve the accepted outcomes, session identities, costs and retention check.

The collector used the real checkout-local CLI on seeded scratch text, not mocked worker transport. Both `=a =b` and `=a b` replaced the inclusive middle range identically; invalidated anchors rejected without changing the file; file assertions and multi-hunk boundaries held. The driver's test-existence claim was `unobservable` because it deliberately did not read tests. The reviewer confirmed the existing parser/end-to-end coverage, ran 20 passing tests and appended its judgment. All three final claims were `held`; no repairs or new tests were needed. No browser, Jev navigation, deterministic Playwright replay or image judgment was involved.

- Setup: literal `null` handoff. README setup completed; the collector discovered that ambient `ab` targets the canonical checkout and used `bun ab/main.ts` plus isolated scratch state. Preparation succeeded without a parent intervention; no failed product encounter.
- Completed encounters: **1**. Delivery-specific parent interventions: **0** in its lifecycle events. Missing states requested by reviewer: **0**. Product defects found: **0**. One test-existence gap resolved by review, not by another collector.
- Retention: closure **`a0079b34bd7886fbbd59025f808fa617c1646b5b`**, integrated at **14:15:59.145 UTC**. All three implement/drive/review worktree paths are absent. Reading the packet from that commit still succeeds; SHA-256 **`670b43d97378d730ba3fb4050e773ea082062e0634a28750d39b9e7199cb8cad`**. The packet survived retirement.
- Pipeline: implement → drive → review → integrate, two role handoffs. No bounced repair, repeated collector, duplicate judgment or repeated setup was observed. The nonvisual review only resolved a design/test-presence claim and explained the diff; that handoff is a candidate for collapse into the existing deterministic test gate, not evidence that all nonvisual reviews are useless.

| Actual role | Model / effort | Recorded nominal USD |
| --- | --- | ---: |
| Implement | `openai-codex/gpt-6-luna:max` | 0.01772658 |
| Collect | `openai-codex/gpt-6.1-sol:high` | 0.08128720 |
| Review | `anthropic/claude-sonnet-5-5:high` | 0.04863370 |
| Accepted delivery's worker subtotal | all three workers | **0.14764748** |

Launch-to-integration was **9 minutes 40 seconds**, including setup/check waits. The collector-only cost would understate even this worker subtotal by about 45%. The subtotal excludes shared supervisor attribution, tool-side model calls and this observation trial; those costs are not zero, just unavailable for reliable per-delivery attribution. It is not a complete accepted-workflow bill.

### Rendered: names and small defects — pending

Names finished its first collection at **14:25:05 UTC**, commit `6a8152c4`: **nine held, one failed, one unobservable**. It used the current list/object evidence handoff, not an old stories map. [In-flight handoff and collector measurements](names-inflight.json) preserve the declared screenshot paths and outcomes. Opus 5.5 **medium** review launched at **14:25:15 UTC** (model/effort confirmed from its session); actual image judgment, repair/re-drive, accepted head, full cost and retirement remain unobserved. This does not yet count as an accepted rendered delivery. Sol high collection recorded **$2.79886840**, explicitly a collector-only subtotal, not accepted-completion cost. Small-defects remains in implement at **14:27:48 UTC**; no encounter packet is available yet.

Useful observations in the unfinished names encounter (read at 14:18 UTC; provisional, not acceptance):

- Jev sign-in and completion waits sometimes exhausted after the application had reached the requested state. For tool **Inspect**, it selected the **Inspect evidence** Material tab and declared success. The collector explicitly refused to count that as tool-inspection evidence and used direct rendered controls. This is a live navigation/judgment miss, not deterministic Playwright replay and not strong-model image review.
- Direct Playwright semantic fill recovered a model-picker setup path after a Jev catalog `max_tokens_exceeded` and omitted CLI options. Seeded state is labeled; a live tutor opened an existing card. These are distinct from a recorded deterministic regression journey.
- The collector reports an actual product failure: Installed Reading variant labels name the variant and locale but omit its configured `text` access mode. It also observes saved Chinese not applying to a public release document. The reviewer has not adjudicated or repaired these yet. Two service receipts disappeared and the browser's 30-minute service lifetime later expired; setup/re-entry was repeated. These remain encounter observations, not accepted-completion totals.

Existing owners for those tooling/setup observations are linked in the names packet. The trial requested the existing supervisor's actual visual-reviewer judgment and final packet/integration/retirement information, not another drive. Missing evidence still required: final current-format handoffs, stronger-model opening/judgment of actual images, repaired-state frames if behavior changes, accepted head and retirement proof for each delivery.

## Interim recommendation

Keep the current collector operating point; one accepted CLI delivery and two unfinished browser journeys cannot justify a cheaper or stronger default. Retain independent rendered image judgment: semantic completion and DOM checks plainly do not substitute for it. Keep repairs and re-drive with the reviewer when it has the needed context; this sample has not reached that stage yet. Revisit the nonvisual review handoff when it contributes only a test-existence check.

Trial overhead itself had one avoidable decision loop: restart coordination preceded checking the already-running daemon's start time. A second `needs-input` report repeated the same pending question while the supervisor's first answer was already queued. Four worker boundary requests plus repeated owner clarification bought no new runtime capability. Check process/code freshness first next time. No duplicate product worker was launched and no shared target was killed.

## Remaining measurements

For each delivery, link the final committed packet, integration ref and original screenshot files; verify the files still exist in the owner's integrated repository after every associated worker/worktree is retired. Record collector and reviewer model/effort from their actual sessions. Rendered deliveries need a transcript-backed opening of the images and a committed judgment, not just a routing receipt or DOM check.

Keep Jev semantic navigation, direct/manual browser interaction, deterministic Playwright replay and strong-model image judgment separate. Record what each actually establishes. The prior disposable smoke's fixture image and mocked worker transport count for none of these live measurements.

Count completed encounters, setup failures, parent interventions, missing states requested and defects found. Also count avoidable handoffs, repeated setup and duplicated judgment. A reviewer who repairs, re-drives and refreshes evidence directly is a success. Identify which stages bought a new observation or judgment, and which could be collapsed.

Accepted completion cost should include implementation, collector, reviewer, retries/repairs and attributable supervisor work where available. Sum harness-recorded assistant `usage.cost.total` only with its limits explicit: nominal cost is not an invoice or subscription consumption; tool-side Jev/model calls and shared parent work may be unavailable. Do not label a collector-only total as accepted completion cost. No permanent telemetry or routing-default change is part of the trial.

## Reproduction

No deployment, auth or seed is required for this observer packet. Product setup remains the delivery owner's responsibility. Read this committed packet and the preflight inventory directly:

```sh
ab read docs/attachments/trial-collected-evidence-and-visual-acceptance/index.md
jq '{daemonPid, daemonRestarted, collectorPreference, visualPreference, jobs}' docs/attachments/trial-collected-evidence-and-visual-acceptance/preflight.json
git show a0079b34bd7886fbbd59025f808fa617c1646b5b:docs/attachments/ab-edit-block-replace-rejects-sigil-second-anchor/index.md
```

Inspect current state for the follow-up (not the historical preflight):

```sh
ab daemon status > /tmp/trial-daemon-current.jsonl
jq -c 'select(.status == "running") | {id, owner: .input.owner, children: .state.children}' /tmp/trial-daemon-current.jsonl
ab check list --status running,queued
ab service list --status running,queued
```

No processes or external resources were started by this observer.

## Friction

`ab mail c7a4ad76` warned that it could not confirm a live subscriber; Concept's actual reply established delivery in this instance. Existing owner: [[projects/mlegls-pi/issues/make-undeliverable-mail-status-visible-to-scripts]]. Do not treat the warning alone as proof that the owner is dead.

The accepted CLI collector's null setup and ambient-checkout discovery recur under [[projects/mlegls-pi/issues/supervised-study-drive-lacks-setup-handoff]]. Its existing owner now links this encounter. No new tooling system or routing-default change was made.

## Checks

The scoped tracker snapshot parsed successfully (`schemaVersion: 1`, ticket stage); `git diff --check` passed. Existing semantic lint ran on the ticket and linked packet, with limited context: completed 0.68, expanded 0.58, superseded 0.70, unowned 0.64, journal 0.56. Its shared quote describes this interim result. Reconciliation: only the restart step was superseded by an explicit owner ruling; two originally required rendered observations remain owned by this open ticket, not new intent or fulfilled delivery. Detailed measurements are in attachments. No product code or permanent acceptance tests were changed.
