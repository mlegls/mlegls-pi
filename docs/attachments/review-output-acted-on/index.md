# Review-output-acted-on: first-use drive

## Predictions (before opening the delivered ticket)

2026-09-30. Persona: the orchestration-audits reader, using a static local research answer. The required peer-board read exposed the implementer's answer before these predictions; they are therefore ticket-derived acceptance expectations, not blind predictions.

1. **Five reports:** I expect `docs/issues/review-output-acted-on.md` to contain an `## answer` with five identifiable glm-flash reports, timestamps, findings and actionable evidence pointers. I will read it as the deliverable, then locate each supplied board ID in the static corpus.
2. **Parent-turn-first:** I expect a concrete parent turn after each report, with report delivery/awareness established before dispositions are scored. I will follow the answer's pointers into the supplied parent sessions, not infer delivery from later commits alone.
3. **Per-finding dispositions:** I expect each finding to be individually classified fixed, consciously declined, or ignored; the counts must reconcile and an acted-on fraction must be given rather than merely a verdict. I will follow report and parent evidence via public log/doc surfaces; no product source, diffs, tests or fixtures will be read.
4. **Durable output:** I expect the answer in the ticket and a one-line verdict in the orchestration-audits leaf, with sufficient path:line evidence to reproduce the study without asking its author.

## Setup

- Deployment: static local Markdown/JSONL, no app/server/browser.
- Owned output: this worktree's committed ticket; shared evidence is read-only at `~/.local/share/pi-board/log.jsonl`, `~/.pi/agent/sessions/`, and repository commit metadata in `/Users/mlegls/dev/mmon/concept` and `/Users/mlegls/dev/arkhai/webapp`.
- Authentication: existing local filesystem access; no secrets or account setup needed.
- Seed/state: existing historical corpus; no writes or seeding to shared evidence.
- Entry point: read `docs/issues/review-output-acted-on.md`, then resolve IDs and parent sessions from the setup handoff.
- Visual: false; screenshots not applicable.

## Session log

Predictions recorded before opening the worktree's delivered ticket. Required peer-board read already exposed the answer (contamination noted above).

Tested revision: `32523025463142398fc29397d14897b66a80afec` (inherited, no setup changes). Static entry point and all five supplied report IDs were readable; selected session headers/model changes and commit metadata resolved. No service readiness or deployment selectors apply.

1. Opened the committed ticket. It ends with a single verdict paragraph at line 18; the required `## answer` and five-report table are absent. Opened the parent issue too. The one-line verdict is in the child leaf, which is a reasonable reading of “back into the leaf”; its location is not scored as a failure.
2. Resolved all supplied IDs in the board JSONL, then matched `from.session` to session headers and model-change records. All five selected reviewers used glm-flash. The handoff's reports are real and reachable even though none use a `review/*` topic.
3. Read report findings, including structured `data.nits`. Found six U2 nits excluded from the stated 17-finding denominator without an explicit policy. No code contents were inspected.
4. Followed the supplied parent sessions. Located direct after-report decisions for both U2 reports and guard-review. Found the forum parent via the report's repository: its actual cwd is `webapp.dev`, absent from the setup handoff. For review-join, two early board reads returned no messages; the report was actually visible at 10:26:27. All five eventually have explicit parent awareness/actions.
5. Read commit metadata only. Named commits exist. The author's display repair is 71m45s after review-join, not within the stated ~1–60m. The unlinked peer table's guard row also fails to reconcile with its total.
6. Recorded selected evidence and exact replay pointers in [observations.md](observations.md). No repairs, server/browser starts, or writes to the shared corpus/repositories.

## Stories and expectations

| Claim / expectation | Outcome | Observation |
|---|---|---|
| Five supplied reports are glm-flash and reachable | held / met | IDs and model/session metadata resolve; the old `review/*` instruction does not describe this sample. |
| Parent turn after every report before scoring | held / met | Five concrete awareness/decision turns; actual delivery for review-join is later than the earliest read calls. |
| Per-finding acted/declined/ignored fractions reconcile | failed / not met | 23 listed entries before grouping versus 17 scored; six U2 nits absent, no exclusion rule. Guard row disagrees with aggregate. |
| Durable `## answer` with five rows and path:line evidence | failed / not met | Only a verdict at ticket line 18; full table exists solely in unlinked board messages. |
| Claimed report-to-fix ~1–60m range | failed / not met | Author display commit occurs 71m45s after its report. |
| Each named repair actually changes behavior | unobservable | Deliberately not verified through implementation; parent prose and final reviews are historical disposition evidence, not a new functional drive of retired apps. |

While using the product I formed two further expectations: a report's structured findings would contribute to its denominator (**not met**); a board-read call would establish delivery (**not met** for the two empty review-join reads, but met by the later actual receipt). These are separate from the initial predictions.

## Frictions

- To learn what the verdict meant, I had to leave the committed ticket and recover an unlinked peer-board completion. A later reader without that incidental context cannot follow the answer.
- Literal `review/*` instructions find the wrong population; the correction is only at the end. Supplied IDs saved this drive.
- The forum parent entry point was omitted from setup; I had to locate `webapp.dev` independently.
- Findings split between body and `data` invite silent undercounting. One U2 report's body omits all three nits present in its structured data.
- The 17-finding total and timing range look precise but lack a reproducible scoring ledger/latency origin.
- `tracker` was initially treated as an executable; `command -v tracker` failed. Loading `ab skill tracker` resolved this: the vault tracker is files, not a CLI named tracker. No unresolved tool failure remains.

## Replayable checks (not tests)

1. **Durable answer:** Read the ticket alone at its delivered revision. Accept only if `## answer` contains five identifiable report rows, timestamp, finding-level classifications and exact evidence paths/lines (or links to a committed ledger), plus an aggregate fraction derivable from those rows. Current result: absent.
2. **Sampling identity:** At board lines 696/700/847/913/981 (IDs in observations.md), resolve the records by ID, compare `from.session` to the associated header `id`, and inspect `model_change.modelId`. Accept five distinct report-bearing sessions using `~z-ai/glm-flash-latest`. Current result: all five match.
3. **Denominator completeness:** Enumerate the finding lists in report bodies and structured `data` once (do not double-count the same item in both). Require every entry to have a disposition or an explicit documented exclusion/subsumption and recompute aggregate fractions. Current result: 23 listed entries, six U2 nits have no scoring/exclusion ledger; some may legitimately be subsumed or non-actionable.
4. **Temporal scoring:** Starting at each report timestamp, locate a parent receipt or turn explicitly referencing its findings, then its disposition. For review-join specifically inspect H:221, H:228, H:233. Accept only H:233 or a later explicit awareness turn, not the empty earlier reads. Current result: awareness precedes scored later dispositions for all five.
5. **Latency:** Use board report timestamps and `git show -s --format='%cI'` for named fix commits; convert both to UTC and state the interval's origin. Accept a range containing 10:24:22.914→11:36:08 for `4a00a731`, or distinguish later spawn-to-fix timing. Current result: 71m45s outside the delivered range.
6. **Guard reconciliation:** Compare the guard row's five entries to its narrative and final aggregate. Accept one consistent fixed/substituted/declined grouping, with any grouping explained. Current result: row says 3 code/2 driven, narrative describes 4 code/1 driven, aggregate agrees with the latter.

## Limits and cleanup

This was a source-blind static research drive, not a new review of the historical repositories. Exact repair semantics, archival contents, ancestry and the full-corpus 17/16 counts remain unverified here. The study's setup reached all report surfaces; missing durable output is a delivered-product failure, not an inaccessible target. Initial predictions were contaminated by the required peer-board read (recorded above).

No containers, services, tunnels, browser pages or remote resources started. Shared data untouched. No product repair performed. Nonvisual packet: `visual: false`, `shots: []`.

## Review (2026-09-30)

Reviewed `ea318a2` against the ticket. All three failed stories were defects of the delivered answer, not of the sampled corpus; repaired in the ticket's `## answer` (commit following `ea318a2`).

| Story / check | Outcome after review |
|---|---|
| Five glm-flash reports reachable | held (unchanged; re-resolved board ids and commit times) |
| Parent-turn-first evidence | held (unchanged; answer now names the parent line for each report) |
| Per-finding accounting | **repaired, held**: `## answer` lists every finding with a disposition. 23 findings = 16 fixed + 4 declined/substituted + 2 ignored + 1 excluded (reviewer asked for no change). Six U2 nits from the driver's list are now scored: u2-review nit 1 fixed (`e2044d1f`), nit 2 ignored, nit 3 excluded; u2-replay-rereview N1/N3 fixed (`daf4972e`), N2 ignored. Guard row corrected to 4 code / 1 substituted (fixes verified in `33cfc8bb`). |
| Durable `## answer` | **repaired, held**: table with topic, timestamp, parent line, findings and dispositions is in `docs/issues/review-output-acted-on.md`; the ticket alone reproduces the study. |
| Claimed repair latency | **repaired, held**: range is 5m06s–71m45s (median ≈10m per fixed finding); origin is the report timestamp. |

Independent checks made in the review, from the target repos (`git show -s --format=%cI`, `git show <commit>:path`), not from the prior answer: the `+08:00` commit times converted to Z; `SourceIdentity` and filler removal in `e2044d1f`; `prior.selfGrade !== args.selfGrade` in `daf4972e`; validation still after `sourceEvent` lookup and `SourceIdentity` spacing unchanged at `1017cfef`; `setRefusal(undefined)`, `boundedLink` and comment rewrite in `33cfc8bb`; `4a00a731` `read.ts` author display; parent lines C:5370/5663/5672 and the guard-drive report.

New observation for the answer's caveats: the forum-search blocker was the parent's own earlier objection (W:629 "same 403 blocker"), so that report confirmed rather than discovered it. Its accepted remedy was the parent's conditional wording, not the reviewer's probe.

No tests: the deliverable is a static research answer over historical logs and repos; the repo has no suite for docs, and the checks (ledger arithmetic, ID/model resolution, timestamps) are re-runnable by reading the recorded commands. Unchanged: `visual: false`, no shots, no services started.
