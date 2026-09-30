# Orchestration audits: first-use drive

Tested revision: `0945251183e14da8ed168ec8e5ac68ea0d4e8673`.
Persona: reader deciding whether orchestration defaults should change, using the ticket and linked research documents. No implementation, tests, fixtures or diffs inspected.

## Setup and predictions — before opening the joined answer

2026-09-30: worktree `/Users/mlegls/dev/mlegls-pi__worktrees/orchestration-audits-drive`, clean at arrival. Handoff says static local JSONL analysis; no deployment, authentication, secrets, seed, server or backend restart. Entry point is `docs/issues/orchestration-audits.md`, joined answer, with child tickets and evidence packets. Setup is complete when those committed documents are readable. No inherited deployment selectors are used.

Required peer-board read exposed implementer/reviewer conclusions before these predictions. This is not a fully blind first encounter. Predictions below follow the supplied ticket's requested measurements, not implementation details.

1. **Joined five-hypothesis answer:** I expect five identifiable findings and working links to each completed child answer/packet. I will follow the links and compare the joined numbers and claims with the final child answers.
2. **Cheap review acted on:** I expect a five-report sample, parent response evidence, per-finding dispositions and an explicit boundary between uptake and independently verified repairs. I will locate its accounting and compare the summary.
3. **Decision readership:** I expect a factor-finish denominator, measured peer reach, ack comparison and missing-read limits, not a conclusion from sends alone. I will compare pull, push and combined reach in the joined and child answers.
4. **Cache-read fence:** I expect a cumulative-cost/tool-index measurement, either a knee or an explicit finding of no knee, and a quantified counterfactual with assumptions. I will check whether policy recommendations exceed that evidence.
5. **Rework effect:** I expect before/after runs, costs, checkpoints and handle-count interpretation, with run-mix confounds. I will compare the joined deltas with the child's table.
6. **Role/model spikiness:** I expect review and verify-story matching, cost and parent acceptance evidence; if matching is unavailable I expect that limit to be prominent and recommendations provisional.
7. **Joint decision and scope:** I expect an explicit decision about the unchanged defaults, corpus availability and honest limits. Historical evidence must not silently become a claim about current messaging or subscription spend. I will check these boundaries without restarting any backend.

No rendered journey: visual false; screenshots none. Actions, outcomes, frictions and replayable checks follow below.

## Session log

1. Opened the supplied joined answer (ticket lines 21–33). All five hypothesis bullets, defaults-unchanged decision, historical-scope statement and five evidence links are present. This was the promised story surface: a committed research document, not a service. No setup failure.
2. Followed all five child tickets, their linked reports and the review sections of their packets. Each child is `stage: done`, and each packet appends final held outcomes after preserving earlier driver failures. No source/diff/test/fixture was opened. The evidence packets are research documentation, not application fixtures.
3. Compared cheap-review accounting: five rows, 23 findings with one exclusion, 16 fixed + 4 declined/substituted + 2 ignored = 22 scored. The joined 16/22 and rounded 5–72 minute repair range match. Child explicitly limits the sample to two runs on 09-15 and says historical repair semantics were not verified in a running app. Parent first-read latency for one report is 2m05s; “~2 min” is a reasonable rounding.
4. Compared decision readership: child report says 112 pull, 42 push, 40 both, 114 combined, 19 neither over 133 decisions. Joined text calls 86% a **pull-only** floor. Calculated `112/133*100 = 84.21052631578947`; `114/133*100 = 85.71428571428571`. Thus the headline combined reach is right, but its parenthetical evidence class is wrong. Child explicitly identifies two push-only decisions. Its dead-tail explanation and ack-scope correction are reachable and agree with the joined prose otherwise.
5. Compared cache-knee claims: joined text says “no interior knee” and “steers are cache-hits, not prefix re-pays”. Reviewed child report instead says **no established common steer-triggered knee**, with slope thresholds in 38/40 sessions, two-line splits at 24.7–61.8% of calls and model-optimal resets at 5–81 calls. It records **26/145 post-follow-up cache misses**, and explicitly rejects both “always invalidate” and “never do”. The joined unconditional cache-hit claim is not supported. Likewise the 100k/200k/300k points are explicit *analysis policies*, not demonstrated historical deployed-fence thresholds; historic effective settings/load times are unknown. Savings 68.5/56.3/32.7% match, and the ideal warm-cache/no-state-rederivation model is explicit in the child.
6. Tried the child's public deterministic estimator without inspecting its implementation: `python3 analysis/cache-read-fence-knee/final.py --estimate-json '{"x":[10000,20000,30000],"P0":10000,"k":0}'` returned `{"counterfactual": 60000}`, exit 0. No tracked changes resulted. This confirms the documented small replay example, not achievable real respawn savings.
7. Compared rework table/report: before/after means $63/$17, medians $10.67/$4.74, never-done 13/183 versus 2/40, checkpoint sends 47/7, sends 1134/100 and one root dispatcher in each resolved run agree with the joined answer. Child names 24 unresolved worker dispatchers and explains one-root was already true. Confounds are prominent. Navigation friction: the child ticket's Result still describes pre-review disagreements as though current; the appended packet review and research report establish the repaired state.
8. Compared role/model research: 0 triad same-target pairs and 1 cross-model failed-attempt pair, descriptive role medians and 3.5h silent-death detection match. Child provides 18 review-worker dispositions and explicitly says verify-story parent actions are not traced. “Parent acceptance symmetric across price classes” in the joined answer compresses “blockers acted on for both models, claims rejected for both”; it is not a measured equal acceptance rate. Current repairing-reviewer cost is outside the verdict-only historical shape.
9. Checked the five local Markdown packet destinations with `Path.is_file()` and the five child tickets' done markers: all present/readable/done. Scope remains named historical runs and local archived JSONL; no current messaging system or deployment was driven. No services, browser pages, tunnels, containers or external resources were started.

## Outcomes and expectations

| Story / prediction | Outcome | Expectation |
|---|---|---|
| Joined answer across five hypotheses with reachable reviewed evidence | failed | Navigation **met**; accurate synthesis **not met** because decision evidence-class and cache generalizations diverge from the final child reports. |
| Cheap review acted on in the five-report sample | held | **Met**: accounting, parent response, repair range and uptake-vs-behavior limit are stated. |
| Decision readership accurately summarized | failed | Denominator/combined reach/dead tail **met**; pull-only label **not met** (84%, not 86%). |
| Cache-knee and respawn interpretation accurately summarized | failed | Quantified ideal-replay savings **met**; unconditional cache-hit/no-interior-knee interpretation **not met**. Reviewed child withdrew these stronger claims. |
| Rework before/after evidence and confounds joined | held | **Met**: requested values match; one-root was true before; attribution is not claimed. |
| Role/model sparse matching and provisional routing joined | held | **Met** with the acceptance-rate wording friction below; no matched model-quality estimate is offered. |
| Defaults-unchanged decision and historical scope recorded | held | **Met as a documented decision**, not proof of the deployed defaults or current messaging behavior. No counterfactual establishes actual subscription/pool savings. |

## Frictions and expectations formed during use

- **Wrong evidence class:** the 86% “pull-only” label made me expect 114 pulled decisions. **Not met**: two were push-only. Exact contradiction: [joined ticket](../../issues/orchestration-audits.md), decision bullet, versus [child report](../../../analysis/decision-broadcasts-read/report.md), Evidence classes.
- **Withdrawn claims resurfaced:** after opening the reviewed cache report I expected its uncertainty to survive joining. **Not met**: the leaf restores “no interior knee” and unconditional cache hits, and blurs modeled policy thresholds with deployed fencing. See [reviewed report](../../../analysis/cache-read-fence-knee/report.md), knee operationalizations, steers and fence contrast.
- **Current versus historical Result:** the rework child Result initially suggests the delivered narrative is still wrong. Expectation formed: a done ticket's Result names the final state. **Not met** there; the [packet's review section](../orchestrate-rework-effect/index.md#review--2026-09-30) supplies it. No repair made.
- **“Symmetric” without a measured equality:** role-model acceptance prose invites a rate comparison that the actual ledger does not promise. Expectation of review uptake in both classes **met**; exact equality is **not established**, and verify-story parent acceptance remains untraced.
- **Blindness limit:** mandatory board read exposed conclusions before predictions. Existing owner: [[projects/mlegls-pi/issues/driver-board-read-leaks-implementer-conclusions]]. No new tooling friction occurred; `ab skill tracker` identified the vault-file adapter, which was usable.

## Replayable checks (no tests written)

1. **Joined navigation:** open `docs/issues/orchestration-audits.md` at the reviewed head; follow every hypothesis ticket and packet link. Accept five readable child answers, each with a clear final reviewed outcome; accept a linked joined-drive packet in Result. Initial child links held; this drive adds its own evidence link.
2. **Review arithmetic:** read the five report rows in `docs/issues/review-output-acted-on.md`; sum their dispositions. Accept 23 entries, one explicit exclusion, and scored 16+4+2=22, matching the leaf. Confirm the child preserves sample and behavior-verification limits. Observed held.
3. **Decision evidence class:** read the child report's pull/push/both counts and calculate `(112+42-40)/133` and `112/133`. Accept combined ~86%, pull-only ~84%, with those labels in the leaf; reject 86% pull-only. Observed failed.
4. **Cache uncertainty propagation:** read the reviewed cache report's knee operationalizations and steer paragraph, then the leaf's corresponding bullet. Accept “no established common steer-triggered knee”, “normally cached but 26/145 misses”, and explicitly modeled context thresholds; reject unconditional cache hits/no interior knee or an inferred historical deployment. Observed failed.
5. **Replay accounting and scope:** run the exact three-call estimator command in log step 6. Accept exit 0 and 60,000, and leaf savings 68.5/56.3/32.7% labeled ideal-replay upper bounds rather than invoice, plan or achieved respawn savings. Observed numeric example held; real savings remain unmeasured.
6. **Rework join:** compare the leaf against the research report's era totals and What moved section. Accept 63→17 mean, 10.67→4.74 median, 13/183→2/40 never-done, 47→7 checkpoints, 1134→100 sends and one root per resolved run in both eras; preserve opus/run-mix and unresolved-dispatcher limits. Observed held. Read the child Result separately; it should distinguish original drive failures from current reviewed outcomes (currently confusing).
7. **Role/model boundaries:** compare the leaf with the role report's matching and acceptance sections. Accept 0 triad pairs, 1 all-model failed-attempt pair, descriptive medians and provisional recommendations; accept uptake for both classes, not numerical acceptance parity or a complete verify-story parent-action trace. Observed substantive matching/routing held; wording imprecise.
8. **Joint decision:** read the scope and decision paragraphs. Accept unchanged defaults as a decision under these limited measurements, not causal credit to the rework, proof about current Orca messaging or measured subscription savings. Observed held.

## Limits and cleanup

This drive verifies the joined-document reader journey and compares its reviewed public research outputs. It is not a new exhaustive audit of 5.7 GB of sessions, an independent historical repair-runtime test, or a current orchestration trial. The tiny estimator replay is the only analysis CLI invoked; no child test code was read or run. No product repairs. No external resources to stop, no server IDs, no screenshots (nonvisual). Product revision remains the tested implementation head plus drive evidence commits.
