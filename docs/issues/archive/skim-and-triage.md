---
stage: done
assignee: agent
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

## Disposition — 2026-09-22

Closed as superseded, not as literal implementation of the proposal below. Current ingress supplies five-level recoverable skims; lib/code.ts and outline-read provide structural reading. The proposed automatic diff-shaped, per-hunk review pipeline was not delivered. Whether that additional operation is wanted is [[projects/mlegls-pi/issues/triage-diff-hunks-for-review]]. [Current reading contract](../../ingress.md).

## Prior scope and evidence

two ingress operations that are not the filter:

skim — abstraction level, not selection. `read` in parent sessions returns the outline by default, bodies on pull; a diff is rendered as a diff-shaped call tree or file tree ("what changed in shape"), deterministic from the graphs before and after. no jev needed.

triage — "does this hunk need a reviewer's judgment": non-mechanical change, API surface, deleted test, deletion generally, security-adjacent. jev as a just-in-time defect predictor (Kamei et al. 2013) per hunk, calibrated; the parent skims the shape and reads hunks above the threshold. a worker's landed result reaches the coordinator as shape diff + triaged hunks + report, never the raw diff.

done: both render through `show`, and the after-spawn `git diff` and main-checkout re-reads in [[projects/mlegls-pi/research/orchestration-audit-2026-09-18]] (56% of coordinator ingress) have a replacement.
