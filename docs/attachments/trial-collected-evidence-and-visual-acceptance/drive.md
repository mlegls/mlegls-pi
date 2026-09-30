# First-user drive of the trial report

## Setup and prediction timing

Tested revision: `284d0e8491df9fd0852d8843cf00a574a096395b`.
Surface: committed observation report, read through the checkout-local CLI. This is not another Concept product drive, rendered journey or image review. Deployment kind: local files; owned target: this drive worktree; persona: report reader; no authentication, seed, server or browser required. Entry point supplied: `bun ab/main.ts read docs/attachments/trial-collected-evidence-and-visual-acceptance/index.md`.

Prediction timing lapse: my first tool call read the supplied index while locating the setup and rules. Its outcomes were visible before I wrote predictions. The following are ticket-derived acceptance expectations, not uncontaminated first-use predictions. That observation cannot be recreated retroactively.

## Expectations before replay and receipt inspection

1. **Three packets survive integration and retirement.** I expect links to one real CLI packet and two rendered packets, exact integrated revisions, and evidence that their workers' worktrees no longer exist. I will read those packet objects and check their recorded hashes and retired paths without reading source, diffs, tests or fixtures.
2. **Actual stronger-model rendered image judgments.** I expect each rendered packet's judgment to name actual images and an actual stronger model/effort; supporting receipts should bind attachments to retained image hashes. Merely launching Opus or passing DOM checks should not count. I will inspect the public report, judgment notes and receipt metadata, not repeat product navigation or claim a new image judgment.
3. **Measurements and recommendation recorded.** I expect all three deliveries' models/efforts, accepted costs with exclusions, setup failures, parent interventions, missing evidence, defects and handoff counts. I expect Jev, deterministic replay and image judgment to remain distinct, and a recommendation on collapsing stages without changing routing defaults.
4. **Coordinated runtime and current handoffs.** I expect either a safe coordinated restart or an explicit accepted substitution, current discovered owners and list-form stories with complete evidence objects. The committed ticket explicitly authorizes the existing-runtime proof instead of a restart; I will not operate the shared daemon.

## Session log

- Initial setup discovery: read the verification and computer-use docs, ticket, report and run board. Board records an explicit owner decision not to restart, plus the three completed observations. No shared seam was changed.
- Preparation: worktree clean; supplied revision present. No external resources started.
- Ran the supplied checkout-local entry point: exit 0, 155 output rows. It reached the observation report, exactly the assigned surface; it does not launch either Concept application.
- Read the committed measurement files and delivery packet Markdown. Read-only `git show` retrieved four packet versions from the canonical repositories. All four hashes matched, and their revisions were ancestors of their respective canonical HEADs. All 34 retained PNG hashes matched, including the names supplemental revision. All nine delivery worker paths were absent. [Replay receipts](drive-receipts.txt).
- Inspected only receipt metadata and referenced image payloads in the retained session JSONL, without reading source/diffs/tests or unrelated transcript text. Names: 13 supervisor attachments plus the reviewer's repair image matched the actual payload hashes and preceding Opus 5.5 medium tool-call context. Small-defects: 23 supervisor attachments (19 originals, four crops) and eight reviewer attachments matched. The per-frame judgment tables are retained in the integrated packets. This verifies the report's image-judgment provenance; I did not open images or perform a new visual judgment.
- Recomputed all nine worker costs from assistant `usage.cost.total`: each matched its recorded cost. Worker total is $14.15404900; the report's workers-plus-bounded-windows arithmetic is $15.15824460. I did not independently recompute the two supervisor windows; their exclusions and mixed attribution remain explicit.
- Read preparation decisions and report recommendations. Current owners, unchanged model preferences and the explicit no-restart substitution are recorded. Names' collector handoff has eleven list-form stories and a complete visual evidence object; small-defects has fourteen list-form stories in both collector and final reviewer handoffs. Nonvisual's final measurement has three held list-form stories and a nonvisual packet. Historical failures remain distinguishable from final declared outcomes.

## Outcomes and expectations

| Story / expectation | Outcome | Observation |
| --- | --- | --- |
| Three packets survive integration and retirement | held; expectation met | Four packet versions read and hash-matched; 34 PNGs retained; all nine worker paths absent. |
| Actual stronger-model rendered image judgments | held; expectation met | Actual transcript image payloads match the receipt manifests, with Opus medium tool-call context; durable per-frame judgments distinguish pixels from DOM/URL/temporal evidence. |
| Measurements and recommendation recorded | held; expectation met | Report names actual models/efforts, worker and partial accepted costs, setup failures, interventions, missing judgments, repairs, navigation distinctions and avoidable handoffs. Recommendation retains collector preference and direct review repair, consolidates image judgment in that review, and conditionally collapses test-existence-only nonvisual review. |
| Coordinated runtime and current handoffs | held; expectation met | Accepted existing-runtime substitution is explicit in ticket and board; current-format handoffs are present. No shared daemon action was taken. This is historical coordination evidence, not a new runtime freshness check. |

Expectation formed while reading the small-defects packet: “opened all 20 PNGs one at a time” would mean 20 distinct original attachments. **Not met:** the trial's actual receipt manifest establishes 19 original attachments, with byte-identical frame 10 covered by frame 06, plus four crops. The trial report explains this correctly; the underlying packet's wording overstates the physical opening count. It does not invalidate coverage of every retained pixel set.

## Frictions

- First-use prediction discipline failed in this drive: setup discovery opened the report before predictions were committed. No retroactive prediction claim is made.
- Following the evidence requires stitching several JSON files and two repositories together. The report supplies exact revisions and hashes, so it was possible without asking another worker or recreating retired deployments.
- The small-defects packet's “all 20” wording and the report's 19-original receipt count initially disagree; the duplicate-frame explanation resolves pixel coverage, not that wording.
- The report explicitly preserves an accepted-but-unwitnessed map-discard claim and unrerun browser tests after rebase. Those are historical acceptance limits, not evidence supplied by this report drive. Existing owner: [[projects/mlegls-pi/issues/review-marks-unwitnessed-map-discard-held-from-code-reading]]. No new tooling failure was encountered.

## Replayable checks

1. **Entry point.** From the drive checkout run `bun ab/main.ts read docs/attachments/trial-collected-evidence-and-visual-acceptance/index.md`. Accept exit 0 and the report heading, three delivery sections, recommendation and evidence limits. No auth or server should be necessary.
2. **Durability.** Read each measurement's `packet.path` with `git -C REPOSITORY show REVISION:PATH`. Use the CLI closure, names integration and supplement, and small-defects supplement revisions printed in the report. Accept the exact recorded SHA-256 for all four packet versions, each revision an ancestor of canonical HEAD, all 14 names and 20 small-defects PNG hashes matching, and all nine worker paths in the receipts absent. Check names PNGs at both integration and supplement; don't compare the earlier names index hash to the later index.
3. **Image provenance.** For each `toolResult` in names' supervisor and original-reviewer receipts and small-defects' supervisor/original-reviewer receipts, locate that JSONL message, decode only its image content and hash it. Accept the manifest hash among the attached hashes, with preceding assistant provider/model `anthropic/claude-opus-5-5` and active thinking level `medium`. Expect 13 + 1 names receipts and 23 + 8 small-defects receipts (the latter includes scratch/test images, not eight distinct retained frames). Read both durable image-judgment tables; a model name alone or DOM success is insufficient.
4. **Costs.** Sum assistant `usage.cost.total` in the nine worker session files named by the measurement manifests. Accept the per-worker amounts in the receipts and $14.15404900 after rounding to eight decimal places. Add the two explicitly bounded window amounts, $0.46517700 and $0.53901860; accept $15.15824460, labelled partial attribution rather than a complete bill.
5. **Honest limits and stage cost.** Read the report's evidence-limit and recommendation sections. Accept explicit separation of Jev navigation, ad hoc browser re-drive, deterministic tests/replays and actual image judgment; an unwitnessed map completion must not become a new live observation. Expect the two supplemental judgment passes to count as avoidable handoffs, direct reviewer repairs not to count as role violations, and no routing-default change.

## Cleanup

No services, browsers, containers, tunnels or deployments were started. Only worktree-local scratch files were created. No product repairs or automated tests were written. This packet is nonvisual because its driven surface is the CLI report; the two underlying rendered deliveries keep their own visual packets.

Packet-writing note: after appending receipt results, an edit using earlier receipt anchors was safely refused with “Nothing was modified.” A fresh bounded read supplied the current anchors and the edit succeeded. This was expected stale-anchor protection, not unresolved tooling failure.
