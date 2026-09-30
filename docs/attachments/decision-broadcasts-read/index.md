# decision-broadcasts-read — first-use drive

## Starting state and predictions (before opening the report or running its CLI)

- Tested revision: `62bbcb30429fa76b247b3bfffb4bbec00e79ef4b`.
- Persona: research reader using the delivered report and its reproduction CLI. No authentication or secrets needed.
- Deployment: none. Shared source corpus is local, live-appending JSONL in `~/.pi/agent/sessions` and `~/.local/share/pi-board/log.jsonl`; no seeding or backend restart authorized or needed.
- Owned output target: `/Users/mlegls/dev/mlegls-pi__worktrees/decision-broadcasts-read-drive/analysis/decision-broadcasts-read/`. Starting checkout clean; committed scripts and report are present. Python 3.14.7 is available.
- Handoff entry point: `python3 analysis/decision-broadcasts-read/extract.py` (about four minutes), then `python3 analysis/decision-broadcasts-read/analyze.py`. Wait for extraction to finish before analysis.
- Nonvisual surface: CLI output, report Markdown and generated research data; no browser journey or screenshots.
- Independence limit: the required coordination-board read exposed the implementer's conclusions before this prediction log. Predictions below derive from the ticket's requested measurements, not those numerical conclusions. No source, diffs, tests or fixtures read.

| Story | Prediction and intended action |
| --- | --- |
| Per-decision peer readership | Run the entry points and open the report. Expect an identifiable factor-finish decision corpus, each decision's timestamp and peer list/count, with subsequent reads and at least-one-read fraction. Expect counts and fraction to reconcile. |
| Push versus pull | Expect subscription injections counted as reads but separately flagged, and peer identity distinct from the original decision sender. Inspect the report and delivered data for those distinctions. |
| Comparison with acks | Expect comparison against the 34 board-wide acks, with scope/window explicitly distinguished from factor-finish decisions and no use of the later reads.jsonl as historical evidence. |
| Visible relays and limits | Expect visible parent relays recorded separately, and limits that distinguish lack of direct read evidence from proof of ignorance. |
| Reproduction and delivery | Expect both commands to finish successfully in this worktree without services or external mutation, write usable outputs into their own directory, and agree with the delivered report. Expect the ticket to lead a reader to the answer. |

## Session log

2026-09-30: Checked the ticket, README, supplied setup and verification instructions. No services, deployment selectors, credentials or browser sessions used. Initial predictions committed before product use.

1. Launched the supplied extraction command from this worktree, with output captured to [extract-output.txt](extract-output.txt). It completed in 86 seconds, exit 0. Readiness was its completed output: 133 decisions, 121 factor-finish topics, 434 messages; generated data present. No service was needed. The printed `acks: 449` is an unscoped extraction total, not the ticket's 34-message comparison.
2. Opened the delivered [report](../../../analysis/decision-broadcasts-read/report.md), then inspected `coverage.json` and `pushes.json` as research outputs. Coverage has 133 unique decision records, timestamps, reader-session lists and event details. The report's evidence classes distinguish pull, push, log-grep, quoted sends and conversation relays.
3. After extraction completed, ran the supplied analysis command; exit 0. [analyze-output.txt](analyze-output.txt) reports 114/133 reached, 112 pull, 42 push, 40 both, 19 neither, and 62 decisions reaching at least three peers. This agrees with the delivered report and the union of the per-decision reader arrays. Repeated analysis against the same extraction; exit 0 and [byte-identical summary](analyze-repeat-output.txt).
4. Inspected two raw corpus records identified by the research outputs, without reading implementation: pull decision `mu1f79hl-l02vqc` occurs in peer `factor-remaining-context`'s `board_read` tool result (`f86b7071`, 2026-09-14T15:52:34.564Z); push-only decision `mu2ino30-r0gn4n` occurs in `finish-materials`'s `custom_message` board injection (`cb7c00d3`, 2026-09-15T10:17:07.043Z). [manual-inspection.txt](manual-inspection.txt) records the session paths and metadata, not full conversation dumps.
5. Independently counted raw board tags for UTC 09-14..09-15: 439 board-wide decisions and 34 ack-tagged messages; factor-finish prefix has 133 decisions and 5 acks. Exact finish-materials topic has 26 decisions, 5 checkpoints and no done. First reads-ledger record is 2026-09-18T16:13:38.376Z. These agree with the report's corrections.
6. Inspected all delivered coverage rows for basic provenance: no counted reader equals its decision sender, and no peer read-result timestamp precedes its decision. The output records zero conversation relays and one quoted-in-send decision. Some continuing peer reads are dated 09-16 (37 event details); the ticket's `ts ≥ decision` method has no upper cutoff, so these were not treated as a failure.
7. Rerunning changed tracked coverage/push outputs because the corpus is live-appending (push extraction total now 1764, compared with 1754 entries in the delivered push file). Restored those tracked generated files after recording results; no product repairs made. Ignored generated extraction data remains within this worktree. No outside process, service, browser, container or deployment was started.

## Outcomes and expectations

| Story | Outcome | Expectation and observation |
| --- | --- | --- |
| Per-decision peer readership | held | **Met.** 133 unique decisions with peer UUID lists and timestamped evidence. Their reach distribution sums to 133; 114 have at least one pull-or-push peer (85.7%, rounded 86%). The report and CLI agree. |
| Push versus pull | held | **Met.** Separate lists yield 112 pull, 42 push, 40 overlap, including two push-only decisions. A sample pull and push injection are visible in the historical session corpus. No counted sender self-read. |
| Comparison with acks | held | **Met.** 34 board-wide ack-tagged messages, 5 scoped to factor-finish; 439 board-wide decisions versus 133 scoped. Reads ledger begins after the run. The report compares distinct reached decisions to acks, rather than pretending the scopes match. |
| Visible relays and limits | held | **Met on the delivered measurement surface.** Relay and quoted-send classes are separate; output is zero conversation/spawn relays and one quoted send. Report explains stored-result and missing-session limits. This drive does not independently exhaustively re-grep the entire corpus to establish the zero-relay claim. |
| Reproduction and delivery | held | **CLI expectations met.** Both commands exit 0, stay within the owned output target, and reproduce headline figures. **Ticket-navigation prediction not met at first use:** the original ticket had no Result/answer or report link; the supplied entry point and directory listing led to the report instead. This packet is now linked from the ticket as required. |

During use, expected analysis to reconcile with the report: **met**. Expected repeated analysis over a completed extraction to be stable: **met**. Expected the report's opening verdict to state clearly which hypothesis was rejected: **not met**; “Verdict: false as stated” follows the quoted hypothesis “decision broadcasts are read,” then reports that most broadcasts were read. The measurements make its intended rejection of the *unread/dead-weight inference* clear, but the opening polarity is confusing.

## Frictions

- Original ticket gives the method but does not point to the delivered answer. Discovery depends on the setup handoff or exploring its output directory.
- Opening verdict uses the opposite polarity from the literal quoted hypothesis; readers must resolve that from the next sentence.
- Extraction prints unscoped `acks: 449`; the report's requested scoped comparison is 34. CLI output does not label that distinction, and analysis does not print the 34/5 comparison.
- Per-decision readers are UUID arrays in JSON, not a compact table with counts and readable peer names. Finding the historical session requires a filename glob; this worked, but is slower than a direct evidence link.
- Report's final line says `frags.txt` is not committed; `git ls-files analysis/decision-broadcasts-read` lists it as tracked.
- Tooling: `tracker --help` returned command-not-found (127). Reused the existing [tracker provisioning issue](../../issues/tracker-command-unavailable-orchestrate-drive.md), copied unchanged from peer commit `2f7b348` so the owner and workaround are durable in this branch. This did not block the CLI drive.

## Replayable checks for review

These are acceptance checks, not tests added by the driver.

1. **Reproduction:** on this local corpus, run extraction to completion and then analysis from the checkout root. Accept exit 0 for both, files under `analysis/decision-broadcasts-read/`, and matching report/CLI headline counts. Repeating analysis without new extraction should give the same summary.
2. **Per-decision reconciliation:** load `coverage.json`, count unique ids, and take each row's union of `strong_peer_readers` and `push_peer_sessions`. Accept 133 unique decisions, 114 nonempty unions and distribution `{0:19,1:33,2:19,3:5,4:3,5:12,6:11,7:7,8:6,9:4,10:6,11:3,12:3,13:2}` on this run. Counts/fraction must be derivable for every row, including empty rows.
3. **Peer/time provenance:** for each counted peer, verify sender exclusion and timestamp at or after decision; replay the two corpus samples in manual-inspection.txt. Accept a real peer `board_read` tool result containing the pull decision, and a `custom_message` board injection containing the push-only decision, not an analyst's later quotation.
4. **Push accounting:** intersect pull/push nonempty decision sets. Accept 112/42/40 and two push-only decisions (`mu2ino30-r0gn4n`, `mu2ivr1j-nyco2g`), with union 114. Push must not silently become pull evidence.
5. **Ack scope:** filter board log by UTC dates 2026-09-14 and 09-15, then factor-finish topic prefix. Accept 439/133 decisions and 34/5 ack-tagged messages; do not equate either with the later reads ledger. User-facing labels should distinguish whole extraction totals from that window.
6. **Relay limits:** inspect the independently labeled relay/quoted-send classes and replay their source records when reviewing the extractor. Accept zero visible conversation/spawn relays and one quoted send for this extraction, with a stated visibility limit rather than an assertion that an unevidenced peer knew nothing.
7. **Navigation and wording:** open the ticket without a setup handoff and follow its Result. Accept a reachable report with per-decision data, and an opening verdict that explicitly rejects unread/dead-weight inference rather than the literal claim that decisions are read. Check the report's committed/generated file inventory against `git ls-files`.

## Boundaries

Nonvisual evidence (`visual: false`, `shots: []`). No source/diff/test/fixture inspection or product repair. Corpus samples and output summaries are research data. Aggregate reconciliation and two provenance samples are ordinary first-use checks, not a new exhaustive audit. Cleanup complete; no resources outside the worktree to retain.

## Review pass

Repairs (in scope; driver's first-use record above is unchanged):

- `report.md` verdict polarity: now says the hypothesis is supported and the "34 acks vs 452 → not read" inference is rejected (friction 2).
- `report.md` median reach was wrong: 2 is the median over all 133; among the 114 reached it is 3.5. Fixed. "84% is a floor" corrected to 86% (84% is the pull-only share).
- `report.md` file inventory: `frags.txt` is tracked; `events.json`/`text_occ.json` are gitignored (friction 5).
- `extract.py` `acks:` line relabelled as unscoped ack tool calls; `analyze.py` now prints the 34 board-wide / 5 factor-finish ack-tagged messages against 114/133 (friction 3).
- Ticket `## Result` now carries a one-line answer and a link to the report (friction 1).
- Friction 4 (UUID arrays, no peer names table) left: `coverage.json` carries session ids and `ev_detail`; a names table is a separate want, not filed as ticket scope.

Tests: `analysis/decision-broadcasts-read/coverage.test.ts` (`bun test analysis/decision-broadcasts-read`, 3 pass) replays checks 2, 4 and the inventory half of 7 against committed `coverage.json`. It is a data test over the delivered output; checks 1, 3, 5, 6 need the live local corpus and stay as manual replays. Check 7's Result-navigation half is a doc property, not tested.

Re-drive after repairs: extract (exit 0) + analyze (exit 0) reproduced 133 / 114 / 112 / 42 / 40 / 19 and the identical distribution; new ack line prints `34 (factor-finish topics: 5)`. Corpus is live (pushes 1767 vs 1754 committed), so generated `coverage.json`/`pushes.json` were restored to the committed versions.

Final per-claim outcomes: all five stories held; the ticket-navigation and verdict-clarity expectations that missed at first use are now repaired.
