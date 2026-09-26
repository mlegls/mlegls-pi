# Connectome configuration trial — 2026-09-26

Keep Connectome for roughly another day, then measure again. Automatic folding across topic shifts is useful: OM required frequent manual decisions about compaction points. The goal is to retain that convenience at lower cost, not to replace Connectome before trying its existing controls.

Settings written at **2026-09-26 05:00 UTC** in `~/.pi/agent/settings.json`:

```json
"connectome": {
  "budgetTokens": 200000,
  "strategy": {
    "kvStableReachTokens": 64000,
    "compressionSlackRatio": 0.25,
    "l1HoldbackChunks": 3,
    "logEffectiveConfig": true
  }
}
```

- **Reach 64k**, formerly the whole window: constrain ordinary cache perturbation without setting it below the 30k recent-history window. The solver can override the trust region for feasibility/quality; count those overrides.
- **Slack 25%**, formerly 10%: target roughly 150k under the unchanged 200k budget, leaving more room between folds. Actual cuts are discrete and can undershoot.
- **Holdback 3**, formerly 1: delay speculative L1 summaries for the newest three closed chunks; actual fold demand bypasses holdback. Background preparation remains enabled to preserve automatic operation.
- **Effective-config logging**: distinguish trial lives from older processes. The adapter now sets the library log path before opening the store so initialization provenance reaches the correct `lib.log`.

No outer-tool, memory-model, thinking-level, dependency-version, or OM-loading change. The installed context-manager remains 0.10.1. This is a configuration trial, not the broader cache-seam/estimator integration work identified in the [audit](bash-exec-cache-2026-09-26.md).

## Activation

New Pi processes use these settings. Existing lives cache their strategy across `/reload`; reload alone does not apply the trial. Restart/resume Pi, or run `/connectome off` followed by `/connectome default` to release and reopen the life. This does not delete its store or memories. Existing workers remain pre-trial until restarted/reopened.

The write timestamp is not the treatment timestamp for every session. Use the `config:effective` records and their explicit values to identify exposure. Project-local strategy overrides still take precedence.

## Smoke check

Compiled a copy of the previously inspected 509-request Luna store twice under baseline and trial settings, at the same 200k budget. Both fit, retained nonempty context, made zero model calls, and emitted identical message bodies on the second compile. Baseline rendered 179,372 estimated tokens; trial rendered 131,474. Cache-breakpoint metadata changed between the first and second compile even in the baseline, so full-object equality is not the stability check. This is a configuration/load check, not evidence of cost improvement. Live stores were not modified by the smoke check.

The two Connectome adapter tests passed. Local rollback snapshot: `/tmp/connectome-config-trial/settings-before.json` (remove the four trial strategy keys to restore the previous settings).

## Reassess around September 27

Count foreground **plus memory-write** cost, generated tokens, fold frequency, recached tokens per fold, trust-region overrides, and memory writes without observed consumption. Compare like models/stances and session stages; exclude old processes from the trial group. Note compaction stalls, degraded recall, or renewed need for manual topic-shift compaction.

Keep it if the cost is acceptable for the automatic context management. If the expensive fold/memory-write pattern persists without enough benefit, restore OM rather than extending this into an open-ended adapter project.
