# Collected evidence and visual acceptance trial

The nonvisual delivery is accepted, integrated and retired. Names is also product-accepted and retired, but its stronger-model image judgment covers only its new repair frame, not the seven collector frames repeated in the final handoff. Small-defects reached review by the 15:07 UTC daemon snapshot. This is a checkpoint, not successful completion of the three-delivery trial. The supervisor authorized ending observation passes with pending work recorded (`muo6u5rd-vno60e`, 2026-09-30 14:15:53 UTC); the original ticket remains open.

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

### Rendered: names — product accepted; image judgment incomplete

Names finished collection at **14:25:05 UTC**, commit `6a8152c4`: **nine held, one failed, one unobservable**. [Historical collector handoff](names-inflight.json) preserves those first-use outcomes. Opus 5.5 **medium** then repaired the picker, repaired Inspect's plain-text handling, fixed the attachment-dialog article error, and reported all eleven stories held. [Post-integration measurements](names.json) preserve the actual final handoff, worker costs, lifecycle events and retained-image hashes.

The picker repair was re-driven in the reviewer's own deployment: reciprocal variant metadata was prepared through the Convex operations used by the existing browser spec, a learner adopted it, and the browser's Installed document showed `Counting in Chinese (zh-CN · text) · canonical` in its DOM options. This was an ad hoc Playwright browser re-drive, not a retained deterministic recorded journey. Chinese was not re-driven. Inspect's non-JSON line breaks were repaired and guarded through `ChatTranscript` in an existing component test; a live tutor tool returning plain text was **not** driven. Reviewer direct repair and re-drive bought useful work without commissioning another collector.

Retention is established at Concept closure **`a36920105c31720355244f6abc9257a643affc2a`**, integrated **14:43:41.170 UTC**. All three implement/drive/review worktree paths are absent, and the closure is an ancestor of the canonical checkout's HEAD. The committed index still reads (SHA-256 **`aa33c6dac8b4d56198405585c591501bb62b40388418855d2e109a2503afe7a3`**); **14 original PNGs** remain readable from Git. The manifest in `names.json` includes each image's blob and hash.

Actual image opening is narrower than the role label implies. The Opus session received **one image**, `14-reading-picker-review-en.png`, at **14:36:57.143 UTC**. Its decoded attachment matches the integrated PNG exactly (SHA-256 **`6731441a82cfeb1d9d5ae48faf3d54d6d3df3c3594dfc53c094fc6ead6ab39e3`**). The committed judgment notes that its closed native select cannot show the option labels; the JSON supplies that evidence. **None of the seven collector frames repeated in the reviewer's final handoff was opened.** This establishes a real, limited image judgment—not judgment of the other required rendered claims. Product acceptance does not waive the trial's missing measurement. Existing Concept owner was asked to obtain those judgments without another drive (`muo8e260-ql7js1`). Owner: [[projects/mlegls-pi/issues/visual-review-accepts-packet-with-unopened-collected-frames]].

| Actual role | Model / effort | Recorded nominal USD |
| --- | --- | ---: |
| Implement | `openai-codex/gpt-6-luna:max` | 0.43339780 |
| Collect | `openai-codex/gpt-6.1-sol:high` | 2.79886840 |
| Review, including repairs/re-drive | `anthropic/claude-opus-5-5:medium` | 1.11315480 |
| Accepted product delivery's worker subtotal | all three workers | **4.34542100** |

Launch-to-integration was **2h18m31s**. This subtotal excludes shared-parent attribution, tool-side Jev/live-tutor calls, observer work and any subsequent missing-image judgment. It is not a complete bill or the cost of completing the still-open trial.

Counts use one whole collector pass and one successful targeted reviewer browser re-drive, not individual clicks: **1 + 1** encounters, **2 required defects repaired**, **1 incidental copy defect repaired**, **0 requests back to the collector**, **0 newly commissioned repair workers**, and **2 role handoffs**. There was **1 automatic report-correction turn**: implementer omitted its initial status sentinel, then resubmitted the handoff. Lifecycle owner commands applied were **0**; the completion wake is not an intervention. The two restart hold/cancel messages reached the collector only after it had finished, and remain trial overhead. This observer made **1 missing-image-judgment request** after retirement.

Five setup-failure categories are documented, not an exhaustive count of failed tool attempts: two vanished service receipts (one grouped outage), an unavailable Playwright import, a model-catalog `max_tokens_exceeded`, the original browser's 30-minute expiry, and the review's one pre-`.env` test failure (passed after setup). Recovery stayed local; no shared daemon was stopped. Wait exhaustion after reaching a desired state is a navigation/completion miss, not an assumed auth failure.

The collector's live navigation also showed:

- Jev selected the **Inspect evidence** Material instead of tool Inspect and declared success. The collector refused to count it, then used direct rendered controls. Other completion waits exhausted after the state was reached.
- Direct Playwright semantic fill recovered model-picker setup after catalog/token failure and omitted compact-snapshot options. It was a setup fallback, not recorded deterministic replay or strong image judgment.
- Private Installed Chinese labels held; public Hub ignored the saved language. The latter remains a product-choice idea, not a required defect silently accepted. Existing owners for these navigation/setup frictions remain linked in the product packet.

### Rendered: small defects — pending

The **14:36 and 14:45 UTC** daemon snapshots show `fix-small-application-state-and-error-defects` in **drive**; by the **15:07 UTC** snapshot it reached **review**. Its integrated list is still empty. The final packet, actual stronger-model judgment, accepted completion cost and retention after retirement remain unobserved. Concept will send a settlement notification; no duplicate work was launched.

## Interim recommendation

Keep the current collector operating point. The accepted CLI and incomplete rendered judgment do not justify changing it. The names reviewer bought two direct repairs, a browser re-drive and a defect-grounded component check; do not bounce that work to another role. Its image-review contribution is still incomplete, so the routed model is not yet evidence that the rendered acceptance split worked. Retain independent image judgment and obtain the missing measurement before evaluating that split. The nonvisual review remains a candidate for collapse when it adds only a test-existence check.

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

Scoped tracker snapshots parsed successfully (`schemaVersion: 1`; original ticket and new image-review friction idea); `git diff --check` passed. Semantic lint refreshed on the ticket and linked packet: completed 0.70, expanded 0.61, stage 0.53, superseded 0.60, unowned 0.68, journal 0.72. Reconciliation: product integration is not the original trial's completed measurement; names' missing image judgments and small-defects' final observations remain required, not new intent. Only the restart instruction was superseded by the owner ruling. The image-review friction has its own owner, other frictions remain linked in the product packet, and the ticket records current state rather than accumulated dated slices. Detailed measurements stay in attachments. No product code or permanent acceptance tests changed.
