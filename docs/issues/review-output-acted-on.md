---
stage: ticket
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/orchestration-audits]]"
---

hypothesis, from [[projects/mlegls-pi/issues/orchestration-audits]]: cheap review output is acted on: sample five glm-flash review reports, find the parent turn after each, check whether findings appear in later edits or commits. if not, review routing is theater.

corpus (verified 2026-09-30): sessions `~/.pi/agent/sessions/<mangled-cwd>/<ISO>_<uuid>.jsonl` — header line has cwd and timestamp; model via `model_change.modelId`, glm flash is `~z-ai/glm-flash-latest` (17 sessions, 09-10..09-18). board sends `~/.local/share/pi-board/log.jsonl` (3942 lines, 09-14..09-30); review sends carry `review/`-prefixed topics (e.g. `review/board-freshness-70188ae`, first line). `reads.jsonl` starts only 09-18T16:13.

method: identify five glm-flash sessions whose board sends are `review/*`; the parent's spawn prompt for each (toolCall input in the parent session file) names the target branch/commit. per report: extract the findings; search the target repo's later commits (`git log -S` on flagged lines/identifiers) and the parent's subsequent turns for action — fixed, consciously declined (parent prose), or ignored. find the parent turn *after* each report before scoring: a finding that lands after the parent moved is not evidence of theater. report the acted-on fraction per finding, not a verdict word.

limits: pre-09-18 sessions have no agent/run tags — match peers via cwd (`__worktrees-<handle>`) and board `from`. "referenced later" is string-plus-prose judgment and overcounts easy fixes. list-price dollars; tokens are the comparable unit.

output: `## answer` here — five reports as (topic, ts, findings, acted/declined/ignored with path:line evidence), then a one-line verdict back into the leaf. expand to a dated `docs/research/` doc only if the table needs one.

verdict (2026-09-30, this run): not theater — 5 glm-flash reports (17 findings), parent-turn-first: 13/17 fixed in code within ~1–60 min (e.g. d40d311+165a39d+c73ab6a+5ea1560; e2044d1f; daf4972e; 33cfc8bb+f7838250; 4a00a731), 1/17 substituted with runtime drives, 3/17 consciously declined and recorded in-repo (cc68bd3f); corpus correction: all 17 glm sessions are 09-15 and reports go out on `<run>/<handle>` topics, not `review/*` (only one `review/*` send exists, mu0rgv82-ef2aac, 09-14, non-glm project).

## Result

First-use drive (2026-09-30): [verification packet](../attachments/review-output-acted-on/index.md). Static report and parent-turn surfaces were reachable; durable answer, finding accounting and latency claims failed verification. Product left unchanged for review.
