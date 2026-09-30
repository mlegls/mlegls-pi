---
stage: ticket
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/orchestration-audits]]"
---

hypothesis, from [[projects/mlegls-pi/issues/orchestration-audits]]: fence on cumulative cache-read: per-session cumulative cost vs tool index for the opus workers; find the knee; estimate what respawn-from-ticket at the knee would have saved.

corpus: opus workers 09-14..09-16 under `~/.pi/agent/sessions` — filter `model_change.modelId` = `claude-opus-5` plus worktree cwd (40 sessions, $849 total, median $13.4). named extremes: `transcript-capture-feasibility` (558 calls, 232M cache-read, $137), `hook-emission-snapshots` (406 calls, 160M, $109). per-message `usage` carries input/output/cache-read tokens and cost.

method: per session, cumulative cache-read tokens (cost ≈ Σ context-at-call-i) against tool-call index; tabulate the curve. the knee is where marginal cost per call diverges — parent steers re-pay the prefix, so correlate knee points with parent steer messages in the same file and with board checkpoint timestamps for the run. counterfactual: respawn-from-ticket at the knee = spend up to knee + fresh-prefix re-reads for the remaining segments; report actual/counterfactual per session, worst cases first.

limits: the live context fence (system-config) bounds context fraction, not cumulative reads — quote the current setting for contrast. list-price dollars, subscription models ride weekly pools; state the knee in tokens, not $.

result: [first-use drive and replayable checks](../attachments/cache-read-fence-knee/index.md) (partial corpus and hypothesis rejection observed; tool-index curves, timestamped knee/checkpoint links, counterfactual accounting, and price caveat need review).
