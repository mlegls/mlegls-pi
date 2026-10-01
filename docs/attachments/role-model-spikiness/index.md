# role-model-spikiness: first-use drive

Tested revision: `aa3946d07680106f55e3f76fdaefdf9d688ddea2`.
Mode: supervised drive of a static research deliverable, not an implementation audit. No source, diff, tests or fixtures read; no product repairs.

## Before first use — 2026-09-30

Entry point supplied: repository plus local session and board JSONL. Deployment: static Markdown research in this worktree; no service or ports. Persona: local reader evaluating routing evidence; existing filesystem access, no additional authentication. State: existing 09-01..09-22 sessions and board log, read-only. No seeding authorized or necessary. The worktree is at the implementer's supplied commit and contains the named research document. The handoff supplied no executable entry point.

Predictions from the ticket's requirements (recorded before opening the research document):

1. **Corpus / matching.** I expect a discoverable inventory covering 09-01..09-22, model identification from session records, explicit comparable-target matching, and a checkable count of cross-model pairs separately for review and verify-story. If fewer than about five defensible pairs exist, I expect the report to say the corpus cannot answer rather than rank models from insufficient data.
2. **Measurements / spikiness.** I expect cost, turns and tool-call counts for each pair, and per-role medians and within-role spread at a stated fixed shape. I should be able to follow a session citation and reproduce a number without reverse-engineering an implementation or finding ephemeral scratch files.
3. **Parent acceptance.** I expect each selected pair to have a trace to the parent's next accept/merge versus checkpoint/respawn action, not merely the child's approval. I expect missing observations to remain unknown.
4. **Routing.** I expect a conclusion linked to the current routing policy, distinguishing observed task variance from a causal model effect and marking any unsupported role/model comparison as untested.

Contamination boundary: the mandatory board read returned the implementer's summary and peer corpus corrections; the ticket itself includes its answer. Those summaries were visible before these predictions. Predictions above come from the ticket requirements, not a claim of blindness to the headline result.

## Session log

- Setup inspection: `git rev-parse HEAD` returned the revision above; initial `git status --short` was empty. The ticket links `docs/research/role-model-spikiness-2026-09-30.md`, which exists. Read the verification evidence rules and mandatory peer board before touching the packet/ticket seam. No deployment selector, browser, server or external process was reused or started.

- Opened the ticket's linked research document as the product surface. It is a 67-line static Markdown report with tables, a matched family, acceptance narrative and routing recommendations. It contains no session inventory, exact session filenames, board IDs, parent-message IDs, calculation command or durable analysis entry point. Nothing was launched.
- Followed named handles into the supplied local JSONL corpus. Independently observed the first user prompt, `model_change` records, assistant usage totals and tool-call block counts. Did not inspect historical source-read responses, product implementation, diffs or tests. Captured metadata in [observed-sessions.json](observed-sessions.json). The observation scanned 755 session files dated 09-01..09-22; strict first-user prefix selection found 45 review and 32 verify-story sessions, with no JSON read errors. This is a mechanical sample-selection replay, **not** an assertion that those prefixes cover every semantic review task.
- Replayed the matched-family table's named sessions. Most individual rows reproduce to the printed precision. Found a wrong-model row and a ratio-summary discrepancy (below).
- Followed U2/U4 review findings into the board's subsequent parent actions, recording selected IDs and excerpts in [observed-acceptance.json](observed-acceptance.json). Also observed a U2 repair spawn in the parent session at 12:17:20Z, identified below. This held for sampled blocker uptake; it does not establish every pair's acceptance or an exhaustive absence of overturned verdicts.
- Read this worktree's `routing.md`, supplied by the handoff. It explicitly says subscription consumption is not list-price spending and GLM must be compared on measured subscription consumption and accepted-task wall time. The research report supplies neither of those measurements.

## Outcomes and evidence

### 1. Corpus / matching — failed

The report acknowledges zero same-exact-target triad pairs and zero verify-story cross-model triad pairs. That is useful and meets the sparse-data expectation for verify-story. However, there is no durable exhaustive inventory establishing those absences or the reported 53/31 role counts. The user's next step is bespoke filesystem discovery rather than a report-supplied reproduction entry point.

The 18 campaign pairs are constructed as 2×4 first-round comparisons plus 5×2 re-review comparisons. They reuse workers; they are not 18 independent encounters. The named re-review family includes a deepseek completion labeled as GLM (see below), so the displayed 10 GLM/astra re-review pairs are not all triad pairs. The model/lane/target confound is disclosed, but its consequences for the low-n limit and independent sample size are not resolved.

The independent strict-prefix observation produced:

| Shape | Model | Observed sessions |
|---|---|---:|
| review | astra | 24 |
| review | GLM | 17 |
| review | opus | 3 |
| review | deepseek | 1 |
| verify-story | sonnet | 19 |
| verify-story | terra | 13 |

These are **not replacement corpus counts**: the report may use additional prompts or exclude failed attempts. Without its inventory and exclusion rules the reported totals cannot be replayed. In particular, dropping the GLM four-turn failure reproduces the reported n=16 and $0.041 median; dropping the failed sonnet `lifecycle-drive-2` attempt reproduces n=18 and the $7.43 median. Neither exclusion is stated in the per-role table. The terra smoke session is acknowledged in the report.

### 2. Measurements / spikiness — failed

Individual matched first-round metrics held:

| Handle | Observed model | Cost $ | Assistant messages / tool calls |
|---|---|---:|---:|
| u1-security-review | GLM | 0.126658795 | 90 / 93 |
| u2-review | GLM | 0.019944075 | 15 / 21 |
| u3-review | astra | 0.714190 | 9 / 8 |
| u4-review | astra | 0.770334 | 10 / 9 |
| u5-review | astra | 0.965310 | 12 / 11 |
| u6-review | astra | 0.484886 | 9 / 8 |

But the report's GLM re-review row `u2-selfgrade-rereview $0.018/25/40` is actually **deepseek**, not GLM. There are two sessions with that handle:

- `--Users-mlegls-dev-mmon-concept__worktrees-u2-selfgrade-rereview--/2026-09-15T12-42-25-850Z_01a0a517-0ab9-736d-a06c-23648672f053.jsonl`: GLM, $0.003214145, 4 assistant messages, 5 tool calls.
- `--Users-mlegls-dev-mmon-concept__worktrees-u2-selfgrade-rereview--/2026-09-15T16-15-11-852Z_01a0a5d9-d5ea-7238-9d25-14febbe4b8b6.jsonl`: deepseek, $0.018372440, 25 assistant messages, 40 tool calls.

The first-round Cartesian pair ratios from the printed family are 3.83, 5.64, 6.08, 7.62, 24.31, 35.81, 38.62 and 48.40. Their median is **15.97×**, not the report's 10×. The ratio of the two group medians is approximately 10.13×; that is a different statistic. The report also says GLM reads were 34–90 turns in this family, but its own `u2-review` row and the session show 15.

The report supplies median/min/max spread but no durable per-role rows supporting the full tables, no fixed-target dispersion analysis, and no quantified separation of task and model effects. Its conclusion “spikiness is in the task, not the model” is stronger than a campaign where model co-varies with target can establish. Saying the cost ratio is an “upper bound” on pure model effect also needs an additional directional assumption about that confound.

### 3. Parent acceptance — failed (sampled blocker uptake held)

U2 GLM blocker uptake is observable:

- Board `mu2mpq98-el9ybh` at 12:09:24Z: U2 incomplete.
- Parent decision `mu2mpwym-op17ke` at 12:09:33Z: repair and re-review before U3.
- Parent session `--Users-mlegls-dev-mmon-concept__worktrees-finish-materials--/2026-09-15T09-58-17-318Z_01a0a480-c3e5-7560-b963-074f78725602.jsonl`, record `cd91abb4` (line 601), 12:17:20.548Z: spawn `u2-review-replay` and close the old reviewer, keeping its branch.
- Board `mu2nm46u-wpiiol` at 12:34:35Z: second blocker; parent `mu2nmaik-khb11g` at 12:34:43Z: repair exact optional raw selfGrade.
- Board `mu2vq8lf-p0wol8` at 16:21:44Z: clear re-review — **the deepseek session**, not a GLM completion.

U4 astra blocker uptake also held: `mu2woxlv-m9l22w` (16:48:43Z) → parent `mu2wp7xw-um2mc4` (16:48:56Z) → `mu2xec6j-eyyt6j` (17:08:28Z, repaired in U5) → `mu2xen27-ijohmn` and `mu2xjamk-c8sgpa` (approval and joined candidate). See [board excerpts](observed-acceptance.json).

The report does not provide per-pair parent dispositions or acceptance rates/costs. “The other 12 lanes merged or checkpointed-to-done” combines different parent actions without identifying the lanes or the evidence for each. The universal “no verdict was overturned … anywhere in the window” has no exhaustive trace. Sampled uptake cannot verify those broader acceptance claims, and the U2 chain cannot be attributed entirely to GLM.

### 4. Routing implication — held as a supplied recommendation, not a validated model-effect estimate

The report ends with an explicit bounded-review default, escalation proposal, untested verify-story comparisons, and stance-depth guidance. The verify-story limitation is clear. These satisfy the presence of routing implications. The first-use reader should not treat the flash retry policy or the categorical task-versus-model conclusion as measured accepted-completion economics: wall time, plan consumption and per-pair accepted workstream cost are absent. No routing file was modified during this drive.

## Expectations

| Prediction / expectation formed in use | Met? | What happened |
|---|---|---|
| Exhaustive discoverable inventory and defensible pair count | Not met | Only aggregate counts and handle families; pair count reuses sessions and includes a mislabeled model. |
| Explicit sparse-data exit for verify-story | Met | Zero cross-model triad pairs identified as unanswerable. |
| Replay cost/turn/tool metrics from named sessions | Partly met | Individual first-round rows reproduce; wrong-model re-review and wrong pair-ratio median. |
| Fixed-shape spread supports separating task versus model | Not met | Min/max ranges shown, but confounded lanes cannot establish the categorical conclusion. |
| Per-pair parent next-action evidence | Not met | Sampled U2/U4 uptake holds, but narrative replaces a full acceptance ledger. |
| Routing implications with uncertainty distinguished | Partly met | Verify-story uncertainty explicit; model-effect/flash-retry claims exceed measurements. |
| Formed while reading: same handle's model stays constant | Not met | GLM failure and deepseek completion share `u2-selfgrade-rereview`; session IDs must identify observations. |

## Frictions

1. No durable inventory or runnable reproduction entry point; had to discover sessions and sum records independently. Setup reached the report and raw corpus, not a packaged analysis CLI.
2. Handles are not unique session identifiers. The report's re-review table crosses models under one handle.
3. “Turns” is not defined; independent observations count assistant-message records. Failed attempts appear excluded from the role medians without a stated selection rule, despite being relevant to accepted completion.
4. Eighteen Cartesian comparisons sound like eighteen independent matched encounters; pairing/dependency and the correct ratio statistic require reconstruction.
5. Acceptance narratives lack per-pair parent IDs. Broad absence/causal claims cannot be followed to evidence from the report.
6. Tooling: required `tracker` was unavailable. Tried PATH, `ab lib tracker`, and the guessed canonical CLI entry point; recorded locally as the fallback. The fallback copy was deduped 2026-09-30 into [tracker-command-unavailable-orchestrate-drive](../../issues/archive/tracker-command-unavailable-orchestrate-drive.md), which already carried the same observation from the orchestrate-rework-effect drive.

## Replayable checks (for the reviewer to encode; no tests written)

1. **Inventory completeness and sparse exit.** Enumerate all 09-01..09-22 session filenames in the supplied root; classify using first user prompts and parent spawn inputs; record inclusion/exclusion reason and every model change by session ID. Accept a durable ledger that regenerates every published count, exposes failed attempts, and distinguishes independent target matches from Cartesian reuses. For zero/low-n comparable pairs, accept “cannot answer at this n,” not a model-quality estimate.
2. **Wrong-model re-review.** Find both `u2-selfgrade-rereview` files; read `model_change` and sum each assistant's `usage.cost.total`, count assistant records and `toolCall` content blocks. Accept separate GLM ($0.003214145, 4/5) and deepseek ($0.018372440, 25/40) observations; the deepseek row must not contribute to triad GLM re-review counts or medians.
3. **Pair-ratio statistic.** Use the six first-round rows above, form all 2×4 astra/GLM ratios, sort and take the middle-two mean. Accept ~15.9668× if labeled median per-pair ratio; ~10.1262× is acceptable only as ratio of group medians. Show session reuse and don't treat eight ratios as eight independent target matches.
4. **Median selection / retries.** Recompute the role tables with the published included-session list. Accept exact agreement at printed precision and explicit reasons for exclusions. Include the cost of failed attempts in any accepted-completion/retry economics, even if completed-session medians are reported separately.
5. **Parent disposition.** For every reported pair, locate the child's report time and the next relevant parent action in board plus parent session records. Accept a session-ID-keyed ledger with accept/merge, checkpoint/repair/respawn, decline or unobservable, exact parent citations, and sampled U2/U4 chains consistent with the IDs above. A child “done” alone must not count as parent acceptance.
6. **Routing calibration.** Compare the recommendation with this worktree's `routing.md` subscription and accepted-completion criteria. Accept clearly labeled hypotheses where plan consumption/wall time or matched-target quality evidence is absent; don't describe a confounded ratio as a causal bound without stating the additional assumption.

## Cleanup / scope

Nonvisual static-document/data journey: `visual: false`, screenshots `[]`. No server, container, tunnel, browser page or remote deployment was started. No source/diff/test/fixture inspection and no repairs. The packet's observation JSON contains only session identifiers, model/usage metadata and selected report/parent-action excerpts; the raw local corpus remains unchanged. Historical board excerpts describe others' runtime actions, not actions performed by this driver.

## Review — 2026-09-30

Reviewed at the driver's packet `5a68761`; repairs are in the research document and new data files. The section above is unchanged (first-use record).

### Repairs

Every failure the driver recorded was in the deliverable, so the repair is to the document and its evidence, not to code:

- **Inventory and reproduction (check 1).** `docs/research/role-model-spikiness.py` walks all 755 session files dated 09-01..09-22 and writes [ledger.json](ledger.json), one row per session by full session id (model from assistant messages, cost, turns, tool calls, tokens, start/last message, last stop reason, exclusion reason). Counts now reproduce: 50 review, 32 verify-story. The driver's "45 + 32" undercounted review because the prefix scan missed the second wording ("review the diff you're pointed at (a ref range, a branch, or a worktree)…", 5 sessions). The report's "53 review workers, opus 7" also did not reproduce: only 3 opus sessions use the template. Exclusion rule stated: `stopReason: error` or smoke (<5 turns); four sessions excluded. With it, sonnet reproduces the report's n=18 and $7.43; glm becomes n=15 / $0.043 because the report's n=16 kept `guard-review-2`, a provider error it called "silent".
- **Wrong-model row (check 2).** `u2-selfgrade-rereview` is two sessions, glm (dead, 4 turns, $0.003214145) and deepseek (25 turns, $0.01837244). The document now counts only the deepseek session as the completed review and says there is no completed-vs-completed same-target pair.
- **Pair-ratio statistic (check 3).** 15.97× is the per-pair median (8 Cartesian ratios from 6 sessions); 10.13× is the ratio of group medians. Both stated; "upper bound on the pure model effect" replaced with "not established". "GLM reads 34–90 turns" was wrong for `u2-review` (15); corrected.
- **Medians (check 4).** The report's even-n medians took the lower middle (terra $1.54 vs true $1.581; turns 68 vs 70.5). Tables now regenerate from the ledger; "astra ≈4× within one era" was 12.7× (later era) and 71× (earlier); glm spread is 6.4× not 9×.
- **Confound (new).** The document said model followed supervisor lane ("materials-lane supervisors got glm; hub/quizzes spawned astra"). U1–U6 are all `concept/factor-finish/materials`; the reviewer model followed the `agents/reviewer.md` `runCommand` pin at spawn time (system-config de37c99, b745ffe, c7a564f, 2e43850) and effort (`:high` glm vs `:low` astra).
- **Wall time (routing.md criterion, missing).** Start → report: glm median 14.3 min (n=9), astra 1.4 min (n=5).
- **Acceptance ledger (check 5).** [acceptance.json](acceptance.json) (`docs/research/role-model-spikiness-acceptance.py`) has one row per review worker (18): board report id, parent decision id, parent session line, latency, disposition; plus per-session board tags for all 32 verify-story workers. The driver's sampled U2/U4 chains reproduce. New findings against the report's universal claims: astra `u3-review` said "no blocking findings" and the parent held U3 and later shipped `requireCompletion on tutor surface.close` (a clear verdict overturned, by the parent); glm `guard-review`, `cursor-guard-review`, `u1-error-delta-review` and `u1-rereview` each had a claim or nit rejected by the parent. The glm `u2-selfgrade-rereview` death was noticed after 3.5 h (parent "waiting on" messages at 13:05-13:22, noticed 16:13); other silent rounds after 36-75 s. Filed [[projects/mlegls-pi/issues/archive/parent-waits-on-worker-that-died-without-a-report]] (stage idea; `tracker` CLI is unavailable, the vault adapter is the file).
- **Routing (check 6).** Recommendations rewritten as hypotheses: nothing here shows flash-class review reaches accepted completion cheaper on routing.md's terms; plan consumption is unmeasured and wall time is ~10× worse. "Retry at flash beats paying up front" dropped for the 3.5 h detection latency. Added the transfer caveat that the corpus reviewers were verdict-only while the current `reviewer` repairs.

### Checks as tests

`docs/research/role-model-spikiness.test.ts` (`bun test`): check 1 (ledger counts, exclusions, single cross-model handle, regeneration from the corpus when present), check 2 (both `u2-selfgrade-rereview` sessions), check 3 (eight ratios, 15.97 vs 10.13, both in the document), check 4 (each table row vs the ledger, true medians), check 5 (18 dispositions, U2/U4 chains, U3 not accepted, board ids and timestamps exist when the board log is present), check 6 (document names plan consumption, wall time, confound, same-story-two-drivers). Dropped: none. These tests read the local session corpus and board log, so their corpus replays skip on other machines.

### Final outcomes

| story | driver | final | note |
|---|---|---|---|
| corpus and matching | failed | held | ledger, exclusion rules, 0/1/0 same-target pair counts, sparse-data exit stated |
| measurements and spikiness | failed | held | numbers regenerate from the ledger; spread and confound stated; wall time added |
| complete parent acceptance evidence | failed | held | per-session ledger for 18 review workers; verify-story per-session board tags; per-lane parent decisions for verify-story are not traced and the document says so |
| routing recommendations present | held | held | rewritten to hypotheses with the missing measurements named |

Caveats: dispositions were curated by reading board reports and parent sessions (no automatic classification); the parent session that spawned U3–U6 is not in the corpus, so those rows cite board ids rather than parent-session lines; costs are list price.
