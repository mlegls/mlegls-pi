# Skim fidelity audit — September 26

## Findings

The current filter can turn an explanatory read into misleading prose. This is not limited to an old prompt or to bypassing the selector. Task-specific reads performed well in this challenge set; ordinary explanation and summary requests exposed semantic damage in the middle retention levels.

- **Specific tasks:** all 32 reads (eight cases × query/focus × two runs) retained their complete sources. All 16 generic orientation reads omitted the source behind recoverable heading notices. Neither group exercised token-skimming fidelity.
- **Explanatory follow-up:** after that initial result, added three natural query forms per case: explain, summarize, and topic-specific background orientation. Of 48 reads, 41 contained a rendered token skim. The 54 rendered pages were 26 skim75, 15 skim50 and 13 verbatim. No live judge/compressor failure occurred. These follow-up query forms were exploratory, not part of the precommitted initial matrix.
- **Recovery:** all 115 displayed-handle checks across the two matrices and their controls returned exact source substrings, including merged omission runs. This checks recoverability, not whether a worker notices damage and pulls before reasoning from it.
- **Historical selection:** seven of eight exact-intent specimens in the existing first-read replay selected every chunk verbatim on both repeats. The long `design.md` read-back still did not. Four additional historical orientation specimens were replayed without exact-retention assertions. The historical script's percentages are source-length-weighted requested retention, not measured rendered bytes.
- **Regression checks:** 12 tests / 175 assertions passed across `lib/ingress.test.ts`, `lib/ingress-retention.test.ts`, `lib/raw.test.ts`, `ab/skill.test.ts` and `extensions/exec/ingress.test.ts`.

### Semantic review

The following are actual current-filter outputs from `explanatory.jsonl`, not the direct-compression control. Each damaged 75% example appears under both explain and summarize requests, in both repeats. The review compares source and rendered relationships; it is not a second Jev judgment.

| Case | Original relationship | Rendered 75% text | Assessment |
| --- | --- | --- | --- |
| filing-condition | tracker issues for vault projects; one-liners otherwise | `issues in vault project (` followed by tracker and a truncated `docs/frictions` path; no “otherwise” | Conditional alternative no longer stated; path damaged. |
| permission-exception | do not stop an unowned server; a matching port is not ownership | `Do not stop existing server unless investigation created it. matching port not proof of ownership.` | Main permission relationship preserved at 75%. |
| evidence-scope | a handler test **does not** establish process-tree cleanup | `passing handler unit test establish process-tree cleanup.` | Reversed evidentiary claim. Later also says running CLIs acquire the patch, losing the original negation. |
| numeric-boundary | checking localhost **does not** identify the owner | `Checking hostname is localhost identify owner.` | Ownership caveat reversed despite preserving the port bounds and no-fallback rule. |
| status-table | only atlas-dev approved; pending and denied are not approved | all three name/status pairs survive | Main table associations preserved despite spacing damage. Explain/orientation selected verbatim. |
| ordering | tests on the old base **do not** certify the rebased result | `Tests on old base certify rebased result` | Reversed verification claim; the main sequence survives, so checking only its key strings would miss this. |
| temporal-causality | a repeated owner ID **does not show** every child had an active run | `repeated owner ID reports children show every child active run.` | Reversed ownership inference; the chronology survives. |
| code-branch | command failure throws, closed requires successfully read target evidence | exact source in explain reads and first summary read | Rendering overhead restores exact text; credit this to rendering, not the selector. Second summary skimmed the prose only. |

Thus five of the eight summary cases show a damaged relationship in this manual review. This is a challenge-set count, not a population miss rate or downstream task-failure rate. At 50%, the permission case becomes `stop server unless investigation created`, and numeric validation becomes `fall inherited URL config missing malformed incomplete`. “Incomplete, may lose relationships” notices accurately warn about risk, but do not make those claims faithful. The harm is not merely loss of fine detail.

### Controls and cost of recovery

The direct 75/50/25% controls reproduce damage but are not used to count live-selection failures. Production filtering strips Markdown headings before compression; its previews can differ from these whole-source controls.

Injected compressor failure was actually exercised in 22 of the explanatory first-run replays (the initial matrix had only verbatim/omit selections, so no compressor call). The existing exact-excerpt fallback preserves the selected passage's text and qualifications. It does not guarantee enough coverage: the filing summary excerpt omits the filing rule, and the timeline excerpt omits the caution against causal inference. This is a ready-made comparator for future work, not a certified replacement policy.

The 256-byte budget controls preserve verbatim evidence even when it exceeds that budget, while demoting peripheral pages to recoverable omissions. Across explanatory controls, the rendered pages become 20 omit / seven verbatim. This is a soft ingress budget, not a host hard-cap test.

Explanatory reads render 30,552 bytes from 35,004 input bytes (12.7% reduction, labels included). This deliberately small corpus says nothing about production economics, but shows why nominal “75%” is not actual savings. No replay-storage census or main-model recovery cost was added here; [the existing economics audit](../ingress-economics/README.md) remains the relevant aggregate study.

### Independent read-back selection defect

The existing historical `design.md` specimen has a 4,439-character command ending in `ls -l design.md; sed -n '1,110p' design.md`. `ingressContext` includes only `code.slice(0, 4000)`, stopping inside the heredoc. The read-back operation never reaches the fidelity judge. Both current adapters use this builder.

`readback.ts` replays the recorded source/query locally, then changes only the query to include the complete command, or supplements it with explicit verification focus. The recorded query skims the introduction and atlas section in both runs; full-command and explicit-focus variants retain all five chunks in both runs. This supports truncation as a contributor for this specimen, not a universal explanation of read-back failures. Receipts retain hashes and distributions, not the private conversation/source. Owner: [[projects/mlegls-pi/issues/ingress-command-prefix-hides-readback-intent]].

### Consequences and limits

Do not treat token-deleted prose as a faithful explanation merely because exact-action prompts select verbatim. Existing exact skill activation remains useful, but does not protect explanations of ordinary source. The open semantic owner is [[projects/mlegls-pi/issues/skims-drop-the-conditions-in-instructions]].

Before adding another fidelity rule or judge, compare the existing exact-excerpt representation against full passages on matched explanation tasks, including missing cross-paragraph qualifications. Separately preserve read-back intent through bounded context construction. These are proposed next steps; this audit changes neither runtime policy nor model routing.

The probes call real `ingress.create`, Jev and the shared LLMLingua compressor. They do not pass through a live bash/exec host or a downstream worker/model. Sources are short and mostly single-chunk; cross-chunk and long-output behavior are not calibrated. Two repeats are not independent workload samples, and probabilities are not calibrated accuracy estimates. No shared service was restarted. Concurrent supervision changes were left untouched.

## Fixed scope

Eight boundary cases cover conditional filing, permission exceptions, evidence limits, numeric bounds, table associations, operation ordering, temporal causality and code branches. The filing sentence comes from the historical issue; the surrounding text and other cases are synthetic. This is a targeted challenge set, not a representative workload or an estimate of production error rates.

Before running live judgments, each case specifies a task, expected answer and exact evidence strings. Evidence-string survival is a diagnostic, not a semantic correctness score: spacing changes can fail it without changing meaning, and all strings can survive while their relationship is damaged.

For each source, run the current production filter twice with (a) the specific task as query, (b) broad orientation query plus the specific task as explicit focus, and (c) broad orientation alone. Relevant decision-bearing passages should be exact in (a)/(b). Orientation may legitimately omit details: review whether the remaining representation misstates the topic, not whether it answers a question the judge never received.

Separately compress every source at 75/50/25 percent. These forced skims expose damage conditional on compression, not evidence that the current selector causes it. Replay the first selection with compressor failure and with a 256-byte budget. Verify all displayed recovery handles against original source substrings. Record actual rendered modes as well as judgments; overhead can turn short skims back into verbatim output.

No prompt changes, routing changes or new production heuristics are part of this audit. Host output caps, a real downstream worker's decision to pull, task completion accuracy and representative calibration require separate checks. Existing historical first-read replays provide a complementary real-source selection check.

Run: `bun docs/research/skim-fidelity/probe.ts > /tmp/skim-fidelity.jsonl`.

## Receipts and reproduction

- `boundaries.jsonl`: original fixed matrix and forced compression controls; source/prompt design committed as `5c8e5d3` before the run.
- `explanatory.jsonl`: exploratory middle-intent matrix; run `bun docs/research/skim-fidelity/probe.ts --middle`. Manifest names the production source revision; the `--middle` probe extension was uncommitted during this run and is retained alongside the receipt.
- `historical-replay.txt`: `bun docs/research/ingress-first-reads/replay.ts 2`; requires the original local sessions.
- `readback.jsonl`: `bun docs/research/skim-fidelity/readback.ts`; requires the original local session. Source hashes identify its five chunks.

JSONL retains full synthetic sources, distributions, rendered outputs, injected failures and pull checks so findings can be inspected without repeating live calls. The evidence-string booleans are deliberately not summarized as accuracy.
