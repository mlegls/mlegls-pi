---
stage: done
assignee: agent
author: session:01a0f2a3-2933-716b-91f8-7f1d50eba567
part-of: "[[projects/mlegls-pi/issues/archive/supervisor-hibernation]]"
---

Superseded 2026-10-01 by [[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]]: `ab supervise` was deleted in the pi 0.99 rebuild (`4b79baa`).

Replay the bounded campaign prepared by [[projects/mlegls-pi/issues/archive/supervisor-hibernation-first-use]] from the same committed base in separate owned checkouts:

- A: memory enabled, hibernation disabled; fold only at the normal context threshold.
- H: hibernation enabled with its journal.
- C: hibernation enabled with the empty-journal selector from [[projects/mlegls-pi/issues/archive/supervisor-hibernation-empty-journal]].

Hold owner model/effort, child routing, issue graph, task inputs, context thresholds, inactivity policy and retention environment fixed apart from the arm selectors. Record actual folds and surviving tails; do not label a run H or C merely because its settings enable hibernation. Each must reach its hibernation path and later wake. Each run starts without the other arms' delivered artifacts or journals.

Use existing session JSONL, memory-attempt metadata and supervise ledgers. Count owner input/output/cache-read/cache-write tokens as available, including fold attempts and failures; do not count only the successful compaction entry or substitute child usage. Count owner wakes with their causes. Before inspecting outcomes, state the counting rule for contradictions: an owner reverses or re-asks a previously settled decision without new evidence warranting it. Link each candidate to the earlier decision and later wake, distinguishing a justified revision from forgetting. Report zero as zero, not absent data.

Done: a committed nonvisual packet under `docs/attachments/supervisor-hibernation-comparison/` contains the three completed runs, reproducible setup/selectors, metric table and linked decision judgments. Report H vs C (journal cost/value) and A vs H (full-context cost/value), including unmatched tails or provider usage fields that limit interpretation. One campaign is a first comparison, not a general efficacy claim. Do not change defaults or run a systematic audit. Stop owned resources after collection.
