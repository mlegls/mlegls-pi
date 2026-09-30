---
stage: done
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/archive/orchestration-audits]]"
---

hypothesis, from [[projects/mlegls-pi/issues/archive/orchestration-audits]]: orchestrate rework (`a7f7a98`, 2026-09-15, system-config: "Route routine work explicitly and reclassify at phase boundaries") worked: runs since with exactly one handle; per-run cost and checkpoint counts vs the 09-14 baseline.

corpus: baseline = 09-14..09-15 board-era runs (the never-done exemplar is `concept/factor-finish/*`); after = 09-16..09-22 (no sessions on 09-17; board-era ends at the 09-22 scope line). grouping: run = board topic prefix in `~/.local/share/pi-board/log.jsonl`; workers per run via session cwds (`__worktrees-<handle>`) under `~/.pi/agent/sessions`. `a7f7a98` confirmed present in system-config (3 files: agents/research.md, dispatch/SKILL.md, orchestrate/SKILL.md).

method: per run, before vs after: worker count, cost (session usage), checkpoint count and never-done fraction (log.jsonl tags), and handle count (distinct parent cwds dispatching into the run). the 09-18 audit's own caveat was that 09-16 alone is "one day, not evidence yet" — the extended window is the point.

confounds to state, not fix: the agent roster changed daily 09-14..16 and opus left the worker roster on 09-16; routing changes (710bee5/869e6a7) landed after the rework. the paseo-era 09-23 campaign ([[projects/mlegls-pi/research/orchestration-audit-2026-09-23]]) is out of scope for this ticket but its coordination numbers answer the same question at larger scale.

report 2026-09-30: [[docs/research/orchestrate-rework-effect]] — script and raw per-run table in docs/analysis/orchestrate-rework-effect/.

## Result

Final (after review 2026-09-30): the report was corrected to match the CLI/TSV; all stories held — see the packet's review section. What follows is the first-use drive's original result, kept as history.

First-use CLI drive: [[docs/attachments/orchestrate-rework-effect/index]] — the supplied command runs and reproduces the published TSV, but the research narrative disagrees with those measurements on era totals, parent-cwd counts, after-era nesting and the prior-audit comparison. See the packet for outcomes and replay checks; no product repairs were made.

## Verification evidence

[Encounter and evidence](../attachments/orchestrate-rework-effect/index.md).
