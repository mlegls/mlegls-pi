# TypeScript cell vs bash as the outer interface — 2026-09-23

Question: was a persistent TypeScript cell (`exec`) the right outer interface over bash plus dedicated read/edit/write tools?

Data: all local Pi session JSONL (2,121 files, 116,094 tool calls; extractor [exec-ts-vs-bash-extract.ts](exec-ts-vs-bash-extract.ts)). **Pre** = 2026-09-02..14 (bash 29,358, read 21,535, edit 4,373, write 2,668, grep 3,493 …). **Post** = 2026-09-16..23 (exec 17,490, nearly exclusive). 09-15 is the transition and is excluded. Main workload is the concept repository in both eras. Observational: model mix, orchestration (pi-subagents → Orca), output caps, ingress filtering and memory compaction all changed at the same time. Classifiers are regexes over results; treat rates as ±.

## Findings

| Hypothesis | Result |
| --- | --- |
| Code cells compose more work per model turn (CodeAct's claim) | **No visible gain.** Operations per model turn: pre 3.00, post 2.74. Bash was already composing: 87% of bash calls had multiple segments (mean 4); 17.8% embedded a python/node heredoc script, including 3,111 file writes. |
| TS adds interface errors | **Yes, ~2 points.** Interface-caused exec errors ≈ 2.7% of cells (TS syntax 160, redeclare/reserved 104, undefined name 103, API-shape TypeErrors 112). Bash equivalents (syntax/quoting, command not found, inline-script runtime errors) ≤ 0.8% of calls, upper bound from a noisy classifier. Exec error rate fell from 6.4% (09-16) to 4.5% (09-22). |
| Payload is where it hurts | **Yes.** Cells with write/edit/replace: 12.2% error, 3.09% TS syntax. Other cells: 4.5% error, 0.47% syntax. Pre: edit tool 4.0%, write tool 0.0%, python-heredoc writes 5.9%. Edit/replace cells alone: 13.7%, of which anchor rejections 7.7 points. |
| Nonzero exits get lost | **Sometimes.** 24% of cells calling sh display only `.stdout` with no stderr, exitCode or `2>&1`. 101 of these returned nothing; 12 were immediately rerun with stderr, which exposed errors such as ENOENT. |
| TS wrapper is verbose | **Negligible.** 34% of cells are one sh call with no logic; wrapper ≈ 52 chars. Output tokens per tool turn did not rise (gpt-6-astra 480 → 348). |
| What TS is used for that bash lacks | state read 12.9% / write 5.4% of cells; loops/map/filter 16%; host services (term, ui, computer, exa, paseo, code, loadSkill) ≈ 13%; Promise.all 1%. |
| Sessions got cheaper | gpt-6-astra: tool turns per user message 16.1 → 10.0, context per turn 114k → 73k, $ per user message 2.96 → 1.15. claude-fable-5-1: 11.7 → 8.8, 162k → 118k, 1.60 → 0.96. **Not attributable to TS:** result size fell with caps and filtering (p50 1,933 → 924 chars, p99 44,875 → 16,536; 7.2% of exec results skimmed or omitted), which bash could have too. |

## Reading

The measured wins come from bounded output, filtering, anchored reads and host services as values, most of which don't depend on the outer language. What the outer language itself did: it paid ~2 points of interface errors, concentrated in payload and cell scoping, for in-process values (state, selections, images, terminal and agent handles, async results).

Payload failures are an in-band signaling problem. JSON tool arguments and quoted heredocs (`<<'EOF'`) are raw channels; TS has none (``` and `${` are live in template literals, and String.raw cannot contain a backtick). Moving payload from edit/write tool arguments into TS literals turned a quoting-free path into the most error-prone one.

## Possible follow-ups

- An out-of-band payload channel: a second exec argument (e.g. named strings) that code references, so file bodies and edit hunks never pass through the TS lexer.
- Surface a nonzero sh exit in the cell output when the cell never read exitCode or stderr.
- Keep cell-scoping hints; redeclare/undefined-name errors are the other TS-specific cost, falling from 2.8% (09-16) to 0.5% (09-22).
